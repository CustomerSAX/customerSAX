import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./client.js";
import { zendeskProvider } from "./provider.js";
import { createRequire } from "node:module";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { resolvers, typeDefs } from "../schema.js";
const { graphql } = createRequire(import.meta.url)("graphql") as typeof import("graphql");

vi.mock("./client.js", async (original) => ({
  ...(await original<typeof import("./client.js")>()),
  api: vi.fn()
}));
const ticket = {
  id: 42,
  subject: "Test",
  status: "open",
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
  requester_id: 1
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ZENDESK_SUBDOMAIN", "acme");
  vi.stubEnv("TICKETING_PROJECT_KEY", "test");
  vi.stubEnv("ZENDESK_FIELD_MAPPINGS", "{}");
});
afterEach(() => vi.unstubAllEnvs());

it("uses the active session project with no env key and ahead of the local fallback", async () => {
  vi.stubEnv("TICKETING_PROVIDER", "zendesk");
  const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);
  for (const fallback of ["", "different-local-project"]) {
    vi.stubEnv("TICKETING_PROJECT_KEY", fallback);
    vi.mocked(api).mockResolvedValueOnce({ results: [ticket], count: 1 });
    const result = await graphql({
      schema,
      contextValue: { projectKey: "b2c-csa" },
      source: `{ ticketPage(projectKey: "untrusted") { results { id projectKey } } }`
    });
    expect(result.errors).toBeUndefined();
    expect(result.data?.ticketPage).toMatchObject({
      results: [{ projectKey: "b2c-csa" }]
    });
  }
});

it("requires project context or an explicit fallback before calling Zendesk", async () => {
  vi.stubEnv("TICKETING_PROVIDER", "zendesk");
  vi.stubEnv("TICKETING_PROJECT_KEY", "");
  const result = await graphql({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    source: `{ ticketPage(projectKey: "untrusted") { total } }`
  });
  expect(result.errors?.[0].message).toContain("An active project is required");
  expect(api).not.toHaveBeenCalled();
});

it("rejects missing projects and other account IDs before calling Zendesk", async () => {
  expect(() => zendeskProvider("")).toThrow("An active project is required");
  await expect(zendeskProvider("test").getTicket("zendesk:other:42")).rejects.toThrow(
    "configured Zendesk account"
  );
  expect(api).not.toHaveBeenCalled();
});
it("creates private tickets and translates priority and custom fields", async () => {
  vi.stubEnv("ZENDESK_FIELD_MAPPINGS", '{"customerId":123}');
  vi.mocked(api).mockResolvedValueOnce({ ticket });
  const result = await zendeskProvider("test").createTicket({
    subject: "Test",
    customerEmail: "a@example.com",
    customerId: "commerce-1",
    priority: "Medium",
    message: "Private",
    comments: [{ id: "n", comment: "Worklog", createdAt: "now", status: "Completed" }]
  });
  expect(result.id).toBe("zendesk:acme:42");
  expect(api).toHaveBeenCalledWith("tickets.json", "POST", {
    ticket: expect.objectContaining({
      priority: "normal",
      comment: { body: "Private\n\nWorklog", public: false },
      custom_fields: [{ id: 123, value: "commerce-1" }]
    })
  });
  expect(api).toHaveBeenCalledTimes(1);
});
it("rejects unmapped business fields and unsupported comment replacement", async () => {
  await expect(
    zendeskProvider("test").createTicket({
      subject: "Test",
      customerEmail: "a@example.com",
      category: "returns"
    })
  ).rejects.toThrow("ZENDESK_FIELD_MAPPINGS for category");
  await expect(
    zendeskProvider("test").updateTicket("42", { comments: [] })
  ).rejects.toThrow("addTicketWorklog");
  expect(api).not.toHaveBeenCalled();
});
it("uses safe updates and appends private worklogs", async () => {
  vi.mocked(api).mockResolvedValueOnce({ ticket }).mockResolvedValueOnce({ ticket });
  await zendeskProvider("test").addWorklog("42", {
    id: "c",
    comment: "Note",
    status: "public",
    createdAt: "now"
  });
  expect(api).toHaveBeenLastCalledWith("tickets/42.json", "PUT", {
    ticket: {
      comment: { body: "Note", public: false },
      safe_update: true,
      updated_stamp: ticket.updated_at
    }
  });
});
it("does not update closed tickets", async () => {
  vi.mocked(api).mockResolvedValueOnce({ ticket: { ...ticket, status: "closed" } });
  await expect(
    zendeskProvider("test").updateTicket("42", { subject: "Edit" })
  ).rejects.toThrow("read-only");
  expect(api).toHaveBeenCalledTimes(1);
});
it("reads comment pages without following vendor-supplied URLs", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({ ticket })
    .mockResolvedValueOnce({
      comments: [{ id: 1, body: "One", author_id: 1, created_at: "now", public: false }],
      next_page: "https://evil.example"
    })
    .mockResolvedValueOnce({
      comments: [{ id: 2, body: "Two", author_id: 1, created_at: "now", public: true }],
      next_page: null
    });
  const result = await zendeskProvider("test").getTicket("42");
  expect(result?.comments.map((c) => c.status)).toEqual(["internal", "public"]);
  expect(vi.mocked(api).mock.calls[2][0]).toContain("page=2");
});
it("handles offsets spanning two search pages", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({
      results: Array.from({ length: 100 }, (_, i) => ({ ...ticket, id: i + 1 })),
      count: 120
    })
    .mockResolvedValueOnce({
      results: Array.from({ length: 20 }, (_, i) => ({ ...ticket, id: i + 101 })),
      count: 120
    });
  const result = await zendeskProvider("test").listTickets({ offset: 95, limit: 10 });
  expect(result.results.map((t) => t.ticketNumber)).toEqual([
    "96",
    "97",
    "98",
    "99",
    "100",
    "101",
    "102",
    "103",
    "104",
    "105"
  ]);
  await expect(zendeskProvider("test").listTickets({ offset: 1000 })).rejects.toThrow(
    "1,000"
  );
});
