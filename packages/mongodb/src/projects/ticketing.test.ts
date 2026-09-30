import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { decrypt } from "../encrypt.js";
import {
  getProjectTicketing,
  prepareTicketing,
  saveProjectTicketing,
  resolveProjectTicketing,
  ticketingSettingsView,
  issueZendeskServiceToken
} from "./ticketing.js";
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
it("encrypts secrets, omits them from views, and retains them on blank updates", () => {
  const saved = prepareTicketing(input);
  expect(saved.subdomain).toBe("acme");
  expect(saved.secretEncrypted).not.toContain(input.clientSecret);
  expect(decrypt(saved.secretEncrypted!)).toBe(input.clientSecret);
  expect(ticketingSettingsView(saved)).toEqual({
    provider: "zendesk",
    subdomain: "acme",
    clientId: "oauth",
    secretSet: true
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
it("uses an atomic unique account reservation and sanitizes duplicate errors", async () => {
  const _id = new ObjectId();
  db.findOne.mockResolvedValue({ _id, clientId: "client" });
  db.updateOne.mockRejectedValue({ code: 11000 });
  await expect(saveProjectTicketing("client", _id.toHexString(), input)).rejects.toThrow(
    "already assigned"
  );
  expect(db.createIndex).toHaveBeenCalledWith(
    { "ticketing.subdomain": 1 },
    expect.objectContaining({ unique: true })
  );
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
