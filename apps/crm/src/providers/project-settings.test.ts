import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resolveProjectCrm } from "@csa/mongodb";
import { resolveCrm } from "./index.js";
import { salesforceProvider } from "../salesforce/provider.js";
vi.mock("@csa/mongodb", async original => ({ ...(await original<typeof import("@csa/mongodb")>()), resolveProjectCrm: vi.fn() }));
vi.mock("../salesforce/project-client.js", () => ({
  projectSalesforceClient: (clientId: string, projectKey: string, settings: { salesforceInstanceUrl: string }) => ({ instanceUrl: settings.salesforceInstanceUrl, clientId, projectKey }),
  salesforceClient: () => ({ env: true })
}));
vi.mock("../salesforce/provider.js", () => ({ salesforceProvider: vi.fn(() => ({ getContact: vi.fn() })) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRM_PROVIDER", "salesforce"); });
afterEach(() => vi.unstubAllEnvs());
it("uses the active client/project settings instead of environment credentials", async () => {
  vi.mocked(resolveProjectCrm).mockResolvedValue({ provider: "salesforce", salesforceInstanceUrl: "https://a.my.salesforce.com" });
  expect((await resolveCrm("project-a", "client-a")).name).toBe("salesforce");
  expect(resolveProjectCrm).toHaveBeenCalledWith("client-a", "project-a");
  expect(salesforceProvider).toHaveBeenCalledWith({ instanceUrl: "https://a.my.salesforce.com", clientId: "client-a", projectKey: "project-a" });
});
it("honors 'none' despite a Salesforce environment default", async () => {
  vi.mocked(resolveProjectCrm).mockResolvedValue({ provider: "none" });
  expect(await resolveCrm("project-b", "client-a")).toEqual({ name: "none", provider: null });
  expect(salesforceProvider).not.toHaveBeenCalled();
});
it("does not fall back when settings cannot be resolved", async () => {
  vi.mocked(resolveProjectCrm).mockRejectedValue(new Error("not authorized"));
  await expect(resolveCrm("project", "client")).rejects.toThrow("not authorized");
  expect(salesforceProvider).not.toHaveBeenCalled();
});
it("rejects missing client context in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(resolveCrm("project")).rejects.toThrow("authenticated client");
  expect(resolveProjectCrm).not.toHaveBeenCalled();
});
