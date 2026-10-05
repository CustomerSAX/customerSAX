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
    salesforceSecretSet: true
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
it("keeps saved Salesforce settings when switching to none", () => {
  const saved = prepareCrm(input);
  expect(prepareCrm({ provider: "none" }, saved)).toMatchObject({ provider: "none", salesforceClientId: "consumer-key" });
});
it("accepts only Salesforce My Domain URLs", () => {
  expect(normalizeSalesforceInstanceUrl("https://acme.my.salesforce.com/lightning")).toBe("https://acme.my.salesforce.com");
  expect(() => normalizeSalesforceInstanceUrl("https://login.salesforce.com")).toThrow("My Domain");
  expect(() => normalizeSalesforceInstanceUrl("http://acme.my.salesforce.com")).toThrow("My Domain");
  expect(() => normalizeSalesforceInstanceUrl("https://evil.example.com")).toThrow("My Domain");
});
it("rejects unknown providers and refuses to store secrets without an encryption key", () => {
  expect(() => prepareCrm({ provider: "hubspot" })).toThrow("Unsupported CRM provider");
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
