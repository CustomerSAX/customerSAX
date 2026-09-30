import { expect, it, vi, beforeEach } from "vitest";
import { projectZendeskClient } from "./project-client.js";
import { issueZendeskServiceToken } from "@csa/mongodb";
import { zendeskRequest } from "./client.js";
vi.mock("@csa/mongodb", () => ({
  projectZendeskCredentials: (settings: { subdomain: string }) => ({
    ...settings,
    clientSecret: "decrypted"
  }),
  issueZendeskServiceToken: vi.fn(async (settings: { subdomain: string }) => ({
    access_token: `token-${settings.subdomain}`,
    expires_in: 1800
  }))
}));
vi.mock("./client.js", () => ({ zendeskRequest: vi.fn(async () => ({})) }));
beforeEach(() => vi.clearAllMocks());
it("keeps concurrent project tokens and API destinations separate and shares an in-flight exchange", async () => {
  const a = projectZendeskClient("client-a", "project", {
    provider: "zendesk",
    subdomain: "alpha",
    secretEncrypted: "v1"
  });
  const b = projectZendeskClient("client-b", "project", {
    provider: "zendesk",
    subdomain: "beta",
    secretEncrypted: "v1"
  });
  await Promise.all([a.api("tickets.json"), a.api("search.json"), b.api("tickets.json")]);
  expect(issueZendeskServiceToken).toHaveBeenCalledTimes(2);
  expect(zendeskRequest).toHaveBeenCalledWith(
    "/api/v2/tickets.json",
    expect.objectContaining({ headers: { authorization: "Bearer token-alpha" } }),
    "alpha"
  );
  expect(zendeskRequest).toHaveBeenCalledWith(
    "/api/v2/tickets.json",
    expect.objectContaining({ headers: { authorization: "Bearer token-beta" } }),
    "beta"
  );
  const rotated = projectZendeskClient("client-a", "project", {
    provider: "zendesk",
    subdomain: "alpha",
    secretEncrypted: "v2"
  });
  await rotated.api("tickets.json");
  expect(issueZendeskServiceToken).toHaveBeenCalledTimes(3);
});
