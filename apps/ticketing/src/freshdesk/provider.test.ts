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
