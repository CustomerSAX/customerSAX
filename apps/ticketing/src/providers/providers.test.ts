import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { resolvers, typeDefs } from "../schema.js";
import { ticketingProviderName } from "./index.js";
const { graphql } = createRequire(import.meta.url)("graphql") as typeof import("graphql");
beforeEach(() => {
  vi.stubEnv("TICKETING_PROVIDER", "internal");
  vi.stubEnv("MONGO_URI", "");
});
afterEach(() => vi.unstubAllEnvs());

it("keeps native GraphQL create/read/update behavior and context scoping", async () => {
  const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);
  const contextValue = { projectKey: "provider-test" };
  const created = await graphql({
    schema,
    contextValue,
    source: `mutation { createTicket(draft: {subject: "Native", projectKey: "untrusted"}) { id subject projectKey } }`
  });
  expect(created.errors).toBeUndefined();
  const ticket = created.data!.createTicket as { id: string; projectKey: string };
  expect(ticket.projectKey).toBe("provider-test");
  const updated = await graphql({
    schema,
    contextValue,
    source: `mutation($id: ID!) { updateTicket(id: $id, patch: {subject: "Updated"}) { subject } }`,
    variableValues: { id: ticket.id }
  });
  expect(updated.errors).toBeUndefined();
  expect(updated.data?.updateTicket).toMatchObject({ subject: "Updated" });
  const page = await graphql({
    schema,
    contextValue,
    source: `{ ticketingProvider ticketPage { results { id comments { id } } } }`
  });
  expect(page.errors).toBeUndefined();
  expect(page.data?.ticketingProvider).toBe("internal");
});
it("rejects unknown providers instead of falling back silently", () => {
  vi.stubEnv("TICKETING_PROVIDER", "typo");
  expect(ticketingProviderName).toThrow("internal or zendesk");
});
