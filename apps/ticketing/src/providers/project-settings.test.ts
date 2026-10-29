import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { buildSubgraphSchema } from "@apollo/subgraph";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  hub: vi.fn(),
  legacy: vi.fn(),
  zendesk: vi.fn()
}));
vi.mock("@csa/mongodb", async (original) => ({
  ...(await original<typeof import("@csa/mongodb")>()),
  assertProjectScope: mocks.authorize,
  resolveProjectTicketing: mocks.legacy,
  nativeTicketLegacyAccess: vi.fn(async () => false)
}));
vi.mock("../zendesk/connection-hub.js", () => ({
  connectionHubZendesk: { forProject: mocks.hub }
}));
vi.mock("../zendesk/provider.js", () => ({ zendeskProvider: mocks.zendesk }));
import { resolveTicketing } from "./index.js";
import type { TicketListOptions } from "./types.js";
import type { TicketListArgs } from "../tickets/types.js";
import { resolvers, typeDefs } from "../schema.js";
const { graphql } = createRequire(import.meta.url)("graphql") as typeof import("graphql");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue(undefined);
  mocks.hub.mockResolvedValue(undefined);
  mocks.zendesk.mockReturnValue({ getTicket: vi.fn() });
  vi.stubEnv("TICKETING_PROVIDER", "zendesk");
});
afterEach(() => vi.unstubAllEnvs());
it("selects enabled Hub Zendesk regardless of the old project provider or environment", async () => {
  const connection = { subdomain: "hub-account", api: vi.fn() };
  mocks.hub.mockResolvedValue(connection);
  expect((await resolveTicketing("project-a", "client-a")).name).toBe("zendesk");
  expect(mocks.authorize).toHaveBeenCalledWith({
    clientId: "client-a",
    projectKey: "project-a"
  });
  expect(mocks.zendesk).toHaveBeenCalledWith("project-a", connection);
  expect(mocks.legacy).not.toHaveBeenCalled();
});
it("uses native tickets when no Hub ticketing provider is selected, without old Zendesk or Freshdesk credentials", async () => {
  mocks.legacy.mockResolvedValue({ provider: "freshdesk" });
  expect((await resolveTicketing("project-a", "client-a")).name).toBe("internal");
  expect(mocks.zendesk).not.toHaveBeenCalled();
  expect(mocks.legacy).not.toHaveBeenCalled();
});
it("requests Zendesk SLA enrichment only when the GraphQL list selects SLA", async () => {
  const listTickets = vi.fn(async (_args: TicketListArgs, _options?: TicketListOptions) => ({
    results: [], total: 0, count: 0, offset: 0
  }));
  mocks.hub.mockResolvedValue({ subdomain: "hub-account", api: vi.fn() });
  mocks.zendesk.mockReturnValue({ getTicket: vi.fn(), listTickets });
  const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);
  const contextValue = { projectKey: "project-a", clientId: "client-a" };

  await graphql({
    schema,
    contextValue,
    source: `{ ticketPage { results { id subject } } }`
  });
  await graphql({
    schema,
    contextValue,
    source: `{ ticketPage { results { id sla { nextDueAt } } } }`
  });

  expect(listTickets.mock.calls.map((call) => call[1])).toEqual([
    { includeSla: false },
    { includeSla: true }
  ]);
});
it("fails closed on Hub outages instead of returning unrelated native or legacy tickets", async () => {
  mocks.hub.mockRejectedValue(new Error("Hub unavailable"));
  await expect(resolveTicketing("project", "client")).rejects.toThrow("Hub unavailable");
  expect(mocks.legacy).not.toHaveBeenCalled();
});
it("rejects unauthorized projects before Hub access", async () => {
  mocks.authorize.mockRejectedValue(new Error("not authorized"));
  await expect(resolveTicketing("project", "client")).rejects.toThrow("not authorized");
  expect(mocks.hub).not.toHaveBeenCalled();
});
it("requires client identity in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(resolveTicketing("project")).rejects.toThrow("authenticated client");
  expect(mocks.hub).not.toHaveBeenCalled();
});
it("rejects notification access without agent identity or after switching projects", async () => {
  const args = { clientId: "client-a", projectKey: "project-a" };
  await expect(
    resolvers.Query.ticketNotifications(null, args, { ...args })
  ).rejects.toThrow("authenticated agent");
  await expect(
    resolvers.Query.ticketNotifications(null, args, {
      ...args,
      projectKey: "project-b",
      userEmail: "agent@example.com",
      userRole: "agent"
    })
  ).rejects.toThrow("Active project changed");
});
