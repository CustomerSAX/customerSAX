import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resolveProjectTicketing } from "@csa/mongodb";
import { resolveTicketing } from "./index.js";
import { zendeskProvider } from "../zendesk/provider.js";
vi.mock("@csa/mongodb", async original => ({ ...(await original<typeof import("@csa/mongodb")>()), resolveProjectTicketing: vi.fn(), nativeTicketLegacyAccess: vi.fn(async () => false) }));
vi.mock("../zendesk/project-client.js", () => ({ projectZendeskClient: (clientId: string, projectKey: string, settings: { subdomain: string }) => ({ subdomain: settings.subdomain, clientId, projectKey }) }));
vi.mock("../zendesk/provider.js", () => ({ zendeskProvider: vi.fn(() => ({ getTicket: vi.fn() })) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("TICKETING_PROVIDER", "zendesk"); });
afterEach(() => vi.unstubAllEnvs());
it("uses the active client/project settings instead of environment credentials", async () => {
  vi.mocked(resolveProjectTicketing).mockResolvedValue({ provider: "zendesk", subdomain: "project-account" });
  expect((await resolveTicketing("project-a", "client-a")).name).toBe("zendesk");
  expect(resolveProjectTicketing).toHaveBeenCalledWith("client-a", "project-a");
  expect(zendeskProvider).toHaveBeenCalledWith("project-a", { subdomain: "project-account", clientId: "client-a", projectKey: "project-a" });
});
it("honors native settings despite a Zendesk environment default", async () => {
  vi.mocked(resolveProjectTicketing).mockResolvedValue({ provider: "internal" });
  expect((await resolveTicketing("project-b", "client-a")).name).toBe("internal");
  expect(zendeskProvider).not.toHaveBeenCalled();
});
it("does not fall back when settings cannot be resolved", async () => {
  vi.mocked(resolveProjectTicketing).mockRejectedValue(new Error("not authorized"));
  await expect(resolveTicketing("project", "client")).rejects.toThrow("not authorized");
  expect(zendeskProvider).not.toHaveBeenCalled();
});
it("rejects missing client context in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(resolveTicketing("project")).rejects.toThrow("authenticated client");
  expect(resolveProjectTicketing).not.toHaveBeenCalled();
});
