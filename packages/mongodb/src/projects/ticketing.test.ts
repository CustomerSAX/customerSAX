import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { decrypt } from "../encrypt.js";
import {
  getProjectTicketing,
  prepareTicketing,
  saveProjectTicketing,
  resolveProjectTicketing,
  ticketingSettingsView,
  issueZendeskServiceToken,
  prepareSlaTargets
} from "./ticketing.js";
const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  dropIndex: vi.fn()
}));
const accounts = vi.hoisted(() => ({ updateOne: vi.fn() }));
vi.mock("../admin/db.js", () => ({ getProjectsCollection: async () => db, getTicketingAccountsCollection: async () => accounts }));
beforeEach(() => {
  vi.resetAllMocks();
  db.dropIndex.mockResolvedValue(undefined);
  accounts.updateOne.mockResolvedValue({ matchedCount: 1 });
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "a".repeat(64));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const input = {
  provider: "zendesk",
  subdomain: "Acme.zendesk.com",
  clientId: "oauth",
  clientSecret: "private-secret"
};
it.each([
  "royalcyber-21430",
  " RoyalCyber-21430 ",
  "royalcyber-21430.zendesk.com",
  "https://royalcyber-21430.zendesk.com/agent/home/tickets",
  "https://royalcyber-21430.zendesk.com/"
])("accepts the reported Zendesk account: %s", subdomain => {
  expect(prepareTicketing({ ...input, subdomain }).subdomain).toBe("royalcyber-21430");
});
it.each([
  "https://royalcyber-21430.zendesk.com.evil.test/agent/home/tickets",
  "https://evil.test/royalcyber-21430.zendesk.com",
  "https://user@royalcyber-21430.zendesk.com/",
  "royalcyber-21430.zendesk.com:443/",
  "-royalcyber-21430",
  "royalcyber-21430-",
  ""
])("rejects invalid Zendesk destinations: %s", subdomain => {
  expect(() => prepareTicketing({ ...input, subdomain })).toThrow("valid Zendesk subdomain");
});
it("encrypts secrets, omits them from views, and retains them on blank updates", () => {
  const saved = prepareTicketing(input);
  expect(saved.subdomain).toBe("acme");
  expect(saved.secretEncrypted).not.toContain(input.clientSecret);
  expect(decrypt(saved.secretEncrypted!)).toBe(input.clientSecret);
  expect(ticketingSettingsView(saved)).toEqual({
    provider: "zendesk",
    subdomain: "acme",
    clientId: "oauth",
    secretSet: true, freshdeskDomain: "", freshdeskApiKeySet: false,
    slaTargets: expect.any(Array)
  });
  expect(prepareTicketing({ ...input, clientSecret: "" }, saved).secretEncrypted).toBe(
    saved.secretEncrypted
  );
  expect(() =>
    prepareTicketing({ ...input, subdomain: "different", clientSecret: "" }, saved)
  ).toThrow("changing");
  expect(prepareTicketing({ provider: "internal" }, saved).subdomain).toBe("acme");
});
it("fails closed without an encryption key and blocks arbitrary credential destinations", () => {
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "");
  expect(() => prepareTicketing(input)).toThrow("SUPERADMIN_ENCRYPTION_KEY");
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "a".repeat(64));
  expect(() => prepareTicketing({ ...input, subdomain: "evil.test/path" })).toThrow(
    "subdomain"
  );
  expect(() => prepareTicketing({ ...input, provider: "typo" })).toThrow("Unsupported");
});
it("rejects project access outside the requested client before writing", async () => {
  db.findOne.mockResolvedValue(null);
  const id = new ObjectId().toHexString();
  await expect(getProjectTicketing("other-client", id)).rejects.toThrow("not found");
  await expect(saveProjectTicketing("other-client", id, input)).rejects.toThrow(
    "not found"
  );
  expect(db.findOne).toHaveBeenCalledWith({
    _id: new ObjectId(id),
    clientId: "other-client"
  });
  expect(db.updateOne).not.toHaveBeenCalled();
  await expect(resolveProjectTicketing("other-client", "project")).rejects.toThrow(
    "does not belong"
  );
});
it("keeps atomic account ownership between clients while allowing projects to share", async () => {
  const _id = new ObjectId();
  db.findOne.mockResolvedValueOnce({ _id, clientId: "client" }).mockResolvedValueOnce(null);
  accounts.updateOne.mockRejectedValue({ code: 11000 });
  await expect(saveProjectTicketing("client", _id.toHexString(), input)).rejects.toThrow("another client");
  expect(accounts.updateOne).toHaveBeenCalledWith(
    { _id: "zendesk:acme", clientId: "client" }, { $setOnInsert: { clientId: "client" } }, { upsert: true }
  );
  expect(db.dropIndex).not.toHaveBeenCalled();
  expect(db.updateOne).not.toHaveBeenCalled();
});
it("exchanges confidential client credentials without redirects and suppresses provider error bodies", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response('{"access_token":"test-token","expires_in":1800}', { status: 200 })
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    issueZendeskServiceToken({
      subdomain: "acme",
      clientId: "oauth",
      clientSecret: "secret"
    })
  ).resolves.toMatchObject({ access_token: "test-token" });
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("https://acme.zendesk.com/oauth/tokens");
  expect(init.redirect).toBe("error");
  expect(JSON.parse(init.body)).toMatchObject({
    grant_type: "client_credentials",
    scope: "read tickets:write"
  });
  fetcher.mockResolvedValue(new Response("private-secret", { status: 403 }));
  await expect(
    issueZendeskServiceToken({
      subdomain: "acme",
      clientId: "oauth",
      clientSecret: "secret"
    })
  ).rejects.toThrow("HTTP 403");
});

it.each([
  input,
  { provider: "freshdesk", freshdeskDomain: "acme", freshdeskApiKey: "private-api-key" }
])("allows one client to use a ticketing account in two projects: $provider", async connection => {
  const first = new ObjectId();
  const second = new ObjectId();
  db.findOne.mockImplementation(async query => query._id ? { _id: query._id, clientId: "client" } : null);
  db.updateOne.mockResolvedValue({ matchedCount: 1 });
  await saveProjectTicketing("client", first.toHexString(), connection);
  await saveProjectTicketing("client", second.toHexString(), connection);
  expect(db.updateOne).toHaveBeenCalledTimes(2);
  expect(accounts.updateOne).toHaveBeenCalledTimes(2);
  expect(accounts.updateOne.mock.calls[0][0]).toEqual(accounts.updateOne.mock.calls[1][0]);
  expect(db.dropIndex).toHaveBeenCalledWith("unique_ticketing_zendesk_account");
  expect(db.dropIndex).toHaveBeenCalledWith("unique_ticketing_freshdesk_account");
});

it("protects legacy ownership in another client before dropping old indexes", async () => {
  const id = new ObjectId();
  db.findOne.mockResolvedValueOnce({ _id: id, clientId: "client" }).mockResolvedValueOnce({ clientId: "another-client", ticketing: { subdomain: "acme" } });
  await expect(saveProjectTicketing("client", id.toHexString(), input)).rejects.toThrow("another client");
  expect(accounts.updateOne).not.toHaveBeenCalled();
  expect(db.dropIndex).not.toHaveBeenCalled();
});

it("tolerates already removed indexes but does not hide migration failures", async () => {
  const id = new ObjectId();
  db.findOne.mockImplementation(async query => query._id ? { _id: query._id, clientId: "client" } : null);
  db.updateOne.mockResolvedValue({ matchedCount: 1 });
  db.dropIndex.mockRejectedValue({ code: 27 });
  await expect(saveProjectTicketing("client", id.toHexString(), input)).resolves.toMatchObject({ provider: "zendesk" });
  db.dropIndex.mockRejectedValue(new Error("not authorized to drop index"));
  await expect(saveProjectTicketing("client", id.toHexString(), input)).rejects.toThrow("not authorized");
});

it("validates native SLA targets and drops priorities with no target", () => {
  expect(prepareSlaTargets([
    { priority: "Urgent", firstResponseMinutes: 15, resolutionMinutes: 240 },
    { priority: "normal", firstResponseMinutes: null, resolutionMinutes: 1440 },
    { priority: "low", firstResponseMinutes: null, resolutionMinutes: null }
  ])).toEqual({
    urgent: { firstResponseMinutes: 15, resolutionMinutes: 240 },
    normal: { firstResponseMinutes: null, resolutionMinutes: 1440 }
  });
  expect(() => prepareSlaTargets([{ priority: "critical", resolutionMinutes: 60 }])).toThrow("Unsupported SLA priority");
  expect(() => prepareSlaTargets([{ priority: "high", firstResponseMinutes: 0 }])).toThrow("between 1 minute and 365 days");
  expect(() => prepareSlaTargets([{ priority: "high", resolutionMinutes: 1.5 }])).toThrow("between 1 minute and 365 days");
  expect(() => prepareSlaTargets([{ priority: "high", resolutionMinutes: 60 }, { priority: "HIGH", resolutionMinutes: 90 }])).toThrow("Duplicate");
});

it("shows every priority's SLA targets in the settings view", () => {
  expect(ticketingSettingsView({ provider: "internal", sla: { targets: { high: { firstResponseMinutes: 60, resolutionMinutes: null } }, updatedAt: new Date() } }).slaTargets).toEqual([
    { priority: "urgent", firstResponseMinutes: null, resolutionMinutes: null },
    { priority: "high", firstResponseMinutes: 60, resolutionMinutes: null },
    { priority: "normal", firstResponseMinutes: null, resolutionMinutes: null },
    { priority: "low", firstResponseMinutes: null, resolutionMinutes: null }
  ]);
});
