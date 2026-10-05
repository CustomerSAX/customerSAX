import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { decrypt } from "../encrypt.js";
import {
  getProjectProducts,
  prepareProducts,
  productsSettingsView,
  resolveProjectProducts,
  saveProjectProducts,
  testProjectProducts
} from "./products.js";

const db = vi.hoisted(() => ({ findOne: vi.fn(), updateOne: vi.fn() }));
vi.mock("../admin/db.js", () => ({ getProjectsCollection: async () => db }));
vi.mock("./test-connection.js", () => ({
  testProjectConnection: vi.fn(async () => ({ ok: true, message: "Connected" }))
}));
const input = {
  provider: "algolia",
  appId: "APP123",
  indexName: "products",
  searchApiKey: "search-only-key"
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "a".repeat(64));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("encrypts keys, excludes them from settings views, and preserves blank updates", () => {
  const saved = prepareProducts(input);
  expect(saved.searchApiKeyEncrypted).not.toContain(input.searchApiKey);
  expect(decrypt(saved.searchApiKeyEncrypted!)).toBe(input.searchApiKey);
  expect(productsSettingsView(saved)).toEqual({
    configured: true,
    provider: "algolia",
    appId: "APP123",
    indexName: "products",
    searchApiKeySet: true
  });
  expect(prepareProducts({ ...input, searchApiKey: "" }, saved)).toEqual(saved);
  expect(
    prepareProducts({ provider: "commercetools" }, saved).searchApiKeyEncrypted
  ).toBe(saved.searchApiKeyEncrypted);
});
it("requires credentials for a different application or index and validates configuration", () => {
  const saved = prepareProducts(input);
  expect(() =>
    prepareProducts({ ...input, appId: "OTHER", searchApiKey: "" }, saved)
  ).toThrow("changing");
  expect(() =>
    prepareProducts({ ...input, indexName: "other", searchApiKey: "" }, saved)
  ).toThrow("changing");
  expect(() => prepareProducts({ ...input, appId: "evil.example/path" })).toThrow(
    "application ID"
  );
  expect(() => prepareProducts({ ...input, indexName: " " })).toThrow("index name");
  expect(() => prepareProducts({ provider: "other" })).toThrow("Unsupported");
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "");
  expect(() => prepareProducts(input)).toThrow("SUPERADMIN_ENCRYPTION_KEY");
});
it("rejects cross-client reads, saves, tests, and runtime resolution", async () => {
  db.findOne.mockResolvedValue(null);
  const id = new ObjectId().toHexString();
  await expect(getProjectProducts("other", id)).rejects.toThrow("not found");
  await expect(saveProjectProducts("other", id, input)).rejects.toThrow("not found");
  await expect(testProjectProducts("other", id, input)).rejects.toThrow("not found");
  await expect(resolveProjectProducts("other", "store")).rejects.toThrow(
    "does not belong"
  );
  expect(db.updateOne).not.toHaveBeenCalled();
});
it("saves settings using both the project and client identity", async () => {
  const _id = new ObjectId();
  db.findOne.mockResolvedValue({ _id, clientId: "client" });
  db.updateOne.mockResolvedValue({ matchedCount: 1 });
  await saveProjectProducts("client", _id.toHexString(), input);
  expect(db.updateOne).toHaveBeenCalledWith(
    { _id, clientId: "client" },
    {
      $set: {
        products: expect.objectContaining({
          provider: "algolia",
          searchApiKeyEncrypted: expect.any(String)
        }),
        updatedAt: expect.any(Date)
      }
    }
  );
});
it("returns a fallback signal only for unconfigured projects and resolves the selected project's search key", async () => {
  db.findOne.mockResolvedValue({});
  expect(await resolveProjectProducts("client", "store")).toBeNull();
  db.findOne.mockResolvedValue({ products: prepareProducts(input) });
  expect(await resolveProjectProducts("client", "store")).toEqual(input);
  expect(db.findOne).toHaveBeenLastCalledWith({
    clientId: "client",
    projectKey: "store"
  });
  db.findOne.mockResolvedValue({
    products: prepareProducts({ provider: "commercetools" }, prepareProducts(input))
  });
  expect(await resolveProjectProducts("client", "store")).toEqual({
    provider: "commercetools"
  });
});
it("tests Algolia without writes, redirects, hit payloads, or provider error disclosure", async () => {
  db.findOne.mockResolvedValue({});
  const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetcher);
  expect(
    (await testProjectProducts("client", new ObjectId().toHexString(), input)).success
  ).toBe(true);
  expect(fetcher).toHaveBeenCalledWith(
    "https://APP123-dsn.algolia.net/1/indexes/products/query",
    expect.objectContaining({
      method: "POST",
      redirect: "error",
      body: JSON.stringify({ query: "", hitsPerPage: 0, analytics: false })
    })
  );
  expect(db.updateOne).not.toHaveBeenCalled();
  fetcher.mockResolvedValue({ ok: false, status: 403 });
  expect(
    await testProjectProducts("client", new ObjectId().toHexString(), input)
  ).toEqual({ success: false, message: expect.stringContaining("HTTP 403") });
});
it("rejects CommerceTools selection for a non-CommerceTools project", async () => {
  db.findOne.mockResolvedValue({ platform: "shopify" });
  await expect(
    saveProjectProducts("client", new ObjectId().toHexString(), {
      provider: "commercetools"
    })
  ).rejects.toThrow("CommerceTools project");
  expect(db.updateOne).not.toHaveBeenCalled();
});
