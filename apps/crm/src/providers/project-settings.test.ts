import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  legacy: vi.fn(),
  project: vi.fn(),
  api: vi.fn(),
  salesforce: vi.fn(),
  zoho: vi.fn(),
  hubspot: vi.fn()
}));
vi.mock("@csa/mongodb", async (original) => ({
  ...(await original<typeof import("@csa/mongodb")>()),
  assertProjectScope: mocks.authorize,
  resolveProjectCrm: mocks.legacy
}));
vi.mock("@csa/connection-hub", async (original) => ({
  ...(await original<typeof import("@csa/connection-hub")>()),
  hubRuntime: { project: mocks.project, api: mocks.api }
}));
vi.mock("../salesforce/provider.js", () => ({ salesforceProvider: mocks.salesforce }));
vi.mock("../zoho/provider.js", () => ({ zohoProvider: mocks.zoho }));
vi.mock("../hubspot/provider.js", () => ({ createHubspotProvider: mocks.hubspot }));
import { resolveCrm } from "./index.js";
const binding = {
  connectorId: "salesforce",
  canonicalAction: "salesforce-custom-api-call",
  enabled: true,
  connectionId: "hub-account",
  allowedIndex: "https://acme.my.salesforce.com"
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRM_PROVIDER", "salesforce");
  mocks.authorize.mockResolvedValue(undefined);
  mocks.project.mockResolvedValue({ bindings: [binding] });
  mocks.salesforce.mockReturnValue({ getContact: vi.fn() });
  mocks.zoho.mockReturnValue({ getContact: vi.fn() });
  mocks.hubspot.mockReturnValue({ getContact: vi.fn() });
});
afterEach(() => vi.unstubAllEnvs());
it("selects Salesforce from enabled Hub actions without resolving legacy credentials", async () => {
  expect((await resolveCrm("project-a", "client-a")).name).toBe("salesforce");
  expect(mocks.legacy).not.toHaveBeenCalled();
  const client = mocks.salesforce.mock.calls[0][0];
  expect(await client.instanceUrl()).toBe("https://acme.my.salesforce.com");
  await client.api("query?q=SELECT", "GET");
  expect(mocks.api).toHaveBeenCalledWith(
    expect.anything(),
    binding,
    "/services/data/v56.0/query?q=SELECT",
    "GET",
    undefined
  );
});
it.each(["hubspot", "zoho-crm"])(
  "selects %s from Hub and uses the expected account API path",
  async (connectorId) => {
    const target = {
      ...binding,
      connectorId,
      canonicalAction: `${connectorId}-custom-api-call`
    };
    mocks.project.mockResolvedValue({ bindings: [target] });
    expect((await resolveCrm("project", "client")).name).toBe(
      connectorId === "zoho-crm" ? "zoho" : "hubspot"
    );
    const api =
      connectorId === "hubspot"
        ? mocks.hubspot.mock.calls[0][0]
        : mocks.zoho.mock.calls[0][0].api;
    await api(connectorId === "hubspot" ? "crm/v3/objects/contacts/42" : "Contacts/42");
    expect(mocks.api).toHaveBeenCalledWith(
      expect.anything(),
      target,
      connectorId === "hubspot" ? "/crm/v3/objects/contacts/42" : "/crm/v8/Contacts/42",
      "GET",
      undefined
    );
  }
);
it("returns no CRM when Hub has no enabled CRM, ignoring old provider defaults", async () => {
  mocks.project.mockResolvedValue({ bindings: [{ ...binding, enabled: false }] });
  expect(await resolveCrm("project", "client")).toEqual({ name: "none", provider: null });
  expect(mocks.legacy).not.toHaveBeenCalled();
});
it("reports missing workspace actions and multiple selected CRMs", async () => {
  mocks.project.mockResolvedValue({
    bindings: [{ ...binding, canonicalAction: "salesforce-create-contact" }]
  });
  await expect(resolveCrm("project", "client")).rejects.toThrow("Custom API Call");
  mocks.project.mockResolvedValue({
    bindings: [binding, { ...binding, connectorId: "hubspot" }]
  });
  await expect(resolveCrm("project", "client")).rejects.toThrow("Multiple CRM");
});
it("rejects project ownership errors before reaching Hub and does not fall back during outages", async () => {
  mocks.authorize.mockRejectedValueOnce(new Error("not authorized"));
  await expect(resolveCrm("project", "client")).rejects.toThrow("not authorized");
  expect(mocks.project).not.toHaveBeenCalled();
  mocks.project.mockRejectedValue(new Error("Hub unavailable"));
  await expect(resolveCrm("project", "client")).rejects.toThrow("Hub unavailable");
  expect(mocks.legacy).not.toHaveBeenCalled();
});
it("requires an authenticated client in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(resolveCrm("project")).rejects.toThrow("authenticated client");
  expect(mocks.project).not.toHaveBeenCalled();
});
