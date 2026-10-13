import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { decrypt } from "../encrypt.js";
import { crmSettingsView, prepareCrm, resolveProjectCrm, saveProjectCrm } from "./crm.js";
import { normalizeSalesforceInstanceUrl } from "./salesforce.js";
const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  createIndex: vi.fn()
}));
vi.mock("../admin/db.js", () => ({ getProjectsCollection: async () => db }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "a".repeat(64));
});
afterEach(() => vi.unstubAllEnvs());
const input = {
  provider: "salesforce",
  salesforceInstanceUrl: "acme-dev-ed.develop.my.salesforce.com/",
  salesforceClientId: "consumer-key",
  salesforceClientSecret: "consumer-secret"
};
it("encrypts the secret, omits it from views, and retains it on blank updates", () => {
  const saved = prepareCrm(input);
  expect(saved.salesforceInstanceUrl).toBe("https://acme-dev-ed.develop.my.salesforce.com");
  expect(saved.salesforceSecretEncrypted).not.toContain(input.salesforceClientSecret);
  expect(decrypt(saved.salesforceSecretEncrypted!)).toBe(input.salesforceClientSecret);
  expect(crmSettingsView(saved)).toEqual({
    provider: "salesforce",
    salesforceInstanceUrl: "https://acme-dev-ed.develop.my.salesforce.com",
    salesforceClientId: "consumer-key",
    salesforceSecretSet: true,
    hubspotPortalId: "",
    hubspotTokenSet: false,
    zohoRegion: "",
    zohoClientId: "",
    zohoSecretSet: false,
    zohoConnected: false,
    zohoOrgId: ""
  });
  expect(prepareCrm({ ...input, salesforceClientSecret: "" }, saved).salesforceSecretEncrypted).toBe(
    saved.salesforceSecretEncrypted
  );
});
it("requires a new secret when the org or consumer key changes", () => {
  const saved = prepareCrm(input);
  expect(() => prepareCrm({ ...input, salesforceClientId: "other", salesforceClientSecret: "" }, saved)).toThrow(
    "consumer secret"
  );
});
it("drops saved credentials (releasing the account) when switching to none or to another CRM", () => {
  const salesforce = prepareCrm(input);
  expect(prepareCrm({ provider: "none" }, salesforce)).toEqual({ provider: "none" });
  const hubspot = prepareCrm({ provider: "hubspot", hubspotAccessToken: "pat-na1-key" }, salesforce);
  expect(hubspot.salesforceSecretEncrypted).toBeUndefined();
  expect(hubspot.salesforceInstanceUrl).toBeUndefined();
  expect(() => prepareCrm({ ...input, salesforceClientSecret: "" }, hubspot)).toThrow("consumer secret");
});
it("accepts only Salesforce My Domain URLs", () => {
  expect(normalizeSalesforceInstanceUrl("https://acme.my.salesforce.com/lightning")).toBe("https://acme.my.salesforce.com");
  expect(() => normalizeSalesforceInstanceUrl("https://login.salesforce.com")).toThrow("My Domain");
  expect(() => normalizeSalesforceInstanceUrl("http://acme.my.salesforce.com")).toThrow("My Domain");
  expect(() => normalizeSalesforceInstanceUrl("https://evil.example.com")).toThrow("My Domain");
});
it("rejects unknown providers and refuses to store secrets without an encryption key", () => {
  expect(() => prepareCrm({ provider: "pipedrive" })).toThrow("Unsupported CRM provider");
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "");
  expect(() => prepareCrm(input)).toThrow("SUPERADMIN_ENCRYPTION_KEY");
});
it("saves scoped to client and reports an org already assigned elsewhere", async () => {
  const _id = new ObjectId();
  db.findOne.mockResolvedValue({ _id, clientId: "client" });
  db.updateOne.mockResolvedValue({ matchedCount: 1 });
  await expect(saveProjectCrm("client", _id.toHexString(), input)).resolves.toMatchObject({ provider: "salesforce" });
  expect(db.updateOne).toHaveBeenCalledWith({ _id, clientId: "client" }, expect.anything());
  db.updateOne.mockRejectedValue({ code: 11000 });
  await expect(saveProjectCrm("client", _id.toHexString(), input)).rejects.toThrow("already assigned");
});
it("defaults to no CRM and rejects projects outside the client", async () => {
  db.findOne.mockResolvedValueOnce({ clientId: "client", projectKey: "p" });
  await expect(resolveProjectCrm("client", "p")).resolves.toEqual({ provider: "none" });
  db.findOne.mockResolvedValueOnce(null);
  await expect(resolveProjectCrm("other", "p")).rejects.toThrow("does not belong");
});
it("stores a HubSpot token encrypted, keeps it on blank updates, and re-resolves the portal for a new token", () => {
  const hub = { provider: "hubspot", hubspotAccessToken: "pat-na1-secret-token" };
  const saved = prepareCrm(hub);
  expect(decrypt(saved.hubspotTokenEncrypted!)).toBe("pat-na1-secret-token");
  expect(crmSettingsView({ ...saved, hubspotPortalId: "42" })).toMatchObject({ provider: "hubspot", hubspotPortalId: "42", hubspotTokenSet: true });
  const kept = prepareCrm({ provider: "hubspot", hubspotAccessToken: "" }, { ...saved, hubspotPortalId: "42" });
  expect(kept).toMatchObject({ hubspotTokenEncrypted: saved.hubspotTokenEncrypted, hubspotPortalId: "42" });
  expect(prepareCrm(hub, { ...saved, hubspotPortalId: "42" }).hubspotPortalId).toBeUndefined();
});
it("rejects values that are not HubSpot private app tokens", () => {
  expect(() => prepareCrm({ provider: "hubspot", hubspotAccessToken: "my-api-key" })).toThrow("starts with pat-");
  expect(() => prepareCrm({ provider: "hubspot" })).toThrow("access token is required");
});
it("requires a grant code to connect Zoho and keeps the connection on blank re-saves", () => {
  const zoho = { provider: "zoho", zohoRegion: "in", zohoClientId: "1000.ABC", zohoClientSecret: "zsecret" };
  expect(() => prepareCrm(zoho)).toThrow("grant code");
  expect(() => prepareCrm({ ...zoho, zohoRegion: "mars", zohoGrantCode: "1000.x" })).toThrow("region");
  const pending = prepareCrm({ ...zoho, zohoGrantCode: "1000.code" });
  expect(decrypt(pending.zohoSecretEncrypted!)).toBe("zsecret");
  expect(pending.zohoRefreshTokenEncrypted).toBeUndefined();
  const connected = { ...pending, zohoRefreshTokenEncrypted: "enc-refresh", zohoOrgId: "42", zohoOrgDomain: "org42" };
  const resaved = prepareCrm({ provider: "zoho", zohoRegion: "in", zohoClientId: "1000.ABC" }, connected);
  expect(resaved).toMatchObject({ zohoRefreshTokenEncrypted: "enc-refresh", zohoOrgId: "42", zohoOrgDomain: "org42" });
  expect(crmSettingsView(resaved)).toMatchObject({ provider: "zoho", zohoRegion: "in", zohoConnected: true, zohoSecretSet: true, zohoOrgId: "42" });
  expect(() => prepareCrm({ provider: "zoho", zohoRegion: "eu", zohoClientId: "1000.ABC" }, connected)).toThrow("client secret");
});
it("never stores the Zoho grant code itself", () => {
  const saved = prepareCrm({ provider: "zoho", zohoRegion: "us", zohoClientId: "id", zohoClientSecret: "s", zohoGrantCode: "1000.one-time" });
  expect(JSON.stringify(saved)).not.toContain("1000.one-time");
});
