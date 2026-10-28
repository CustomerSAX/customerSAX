import { beforeEach, expect, it, vi } from "vitest";
import { freshdeskProvider } from "./provider.js";
const api = vi.hoisted(() => vi.fn());
vi.mock("@csa/mongodb", () => ({ freshdeskClient: () => api }));
const remote = {
  id: 42,
  subject: "Test",
  status: 2,
  priority: 3,
  created_at: "2026-01-01",
  updated_at: "2026-01-02"
};
const provider = () =>
  freshdeskProvider("project", { domain: "acme.freshdesk.com", apiKey: "key" });
beforeEach(() => vi.resetAllMocks());
it("rejects another account's ticket ID before making any request", async () => {
  await expect(provider().getTicket("freshdesk:other.freshdesk.com:42")).rejects.toThrow(
    "configured Freshdesk account"
  );
  expect(api).not.toHaveBeenCalled();
});
it("maps ticket pages and fetches older tickets explicitly", async () => {
  api.mockResolvedValueOnce([remote]);
  const page = await provider().listTickets({});
  expect(page).toMatchObject({
    total: 1,
    results: [
      {
        id: "freshdesk:acme.freshdesk.com:42",
        projectKey: "project",
        status: "Open",
        priority: "high"
      }
    ]
  });
  expect(api).toHaveBeenCalledWith(expect.stringContaining("updated_since="));
});
it("escapes customer text and translates create fields", async () => {
  api.mockResolvedValueOnce(remote);
  await provider().createTicket({
    subject: "Test",
    customerEmail: "test@example.com",
    priority: "High",
    message: "<script>"
  });
  expect(api).toHaveBeenCalledWith(
    "tickets",
    "POST",
    expect.objectContaining({
      email: "test@example.com",
      priority: 3,
      status: 2,
      description: "&lt;script&gt;"
    })
  );
});
it("adds private notes and reads conversations on details", async () => {
  api
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(remote)
    .mockResolvedValueOnce([
      { id: 1, body_text: "Private", private: true, user_id: 2, created_at: "now" }
    ]);
  const result = await provider().addWorklog("42", {
    id: "1",
    comment: "Private",
    createdAt: "now",
    status: "internal"
  });
  expect(api).toHaveBeenCalledWith("tickets/42/notes", "POST", {
    body: "Private",
    private: true
  });
  expect(result?.comments[0].status).toBe("internal");
});
it("displays custom fields including false and zero", async () => {
  api
    .mockResolvedValueOnce({
      ...remote,
      custom_fields: { cf_enabled: false, cf_count: 0 }
    })
    .mockResolvedValueOnce([
      { name: "cf_enabled", label: "Enabled", type: "checkbox" },
      { name: "cf_count", label: "Count", type: "number" }
    ]);
  expect(await provider().getFields!("42")).toEqual([
    { id: "cf_enabled", label: "Enabled", type: "checkbox", value: "No" },
    { id: "cf_count", label: "Count", type: "number", value: "0" }
  ]);
});
it("maps SLA deadlines with outcomes only from Freshdesk's own timestamps", async () => {
  const due = { fr_due_by: "2026-01-02T10:00:00Z", due_by: "2026-01-05T10:00:00Z" };
  api.mockResolvedValueOnce([
    { ...remote, id: 1, ...due },
    { ...remote, id: 2, ...due, stats: { first_responded_at: "2026-01-02T11:00:00Z" } },
    { ...remote, id: 3, ...due, status: 3, stats: { first_responded_at: "2026-01-02T09:00:00Z" } },
    { ...remote, id: 4, ...due, status: 4, fr_escalated: true, stats: { resolved_at: "2026-01-04T00:00:00Z" } },
    { ...remote, id: 5, ...due, status: 6 },
    { ...remote, id: 6 }
  ]);
  const { results } = await provider().listTickets({ sortKey: "ticketNumber", sortOrder: "asc" });
  const stages = results.map((t) => t.sla?.metrics.map((m) => m.stage));
  expect(stages).toEqual([
    ["running", "running"],
    ["missed", "running"],
    ["met", "paused"],
    ["missed", "met"],
    ["unknown", "unknown"],
    undefined
  ]);
  expect(results[0].sla).toMatchObject({ source: "freshdesk", nextDueAt: due.fr_due_by });
  expect(results[2].sla?.nextDueAt).toBeNull();
  expect(results[5].sla).toBeNull();
  expect(api).toHaveBeenCalledWith(expect.stringContaining("include=requester,stats"));
});
it("ignores a stale resolved time on a reopened ticket", async () => {
  api.mockResolvedValueOnce([
    { ...remote, due_by: "2026-01-05T10:00:00Z", stats: { resolved_at: "2026-01-04T00:00:00Z" } }
  ]);
  const { results } = await provider().listTickets({});
  expect(results[0].sla?.metrics[0]).toMatchObject({ stage: "running", completedAt: null });
});
it("sorts by soonest running SLA deadline, leaving tickets without one last", async () => {
  api.mockResolvedValueOnce([
    { ...remote, id: 1 },
    { ...remote, id: 2, due_by: "2026-01-09T00:00:00Z" },
    { ...remote, id: 3, fr_due_by: "2026-01-03T00:00:00Z", due_by: "2026-01-08T00:00:00Z" },
    { ...remote, id: 4, status: 3, due_by: "2026-01-01T00:00:00Z" }
  ]);
  const { results } = await provider().listTickets({ sortKey: "slaDueAt" });
  expect(results.map((t) => t.ticketNumber)).toEqual(["3", "2", "1", "4"]);
});
