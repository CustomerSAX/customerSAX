import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { createProject } from "./repository.js";

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  createIndex: vi.fn()
}));

vi.mock("../admin/db.js", () => ({ getProjectsCollection: async () => db }));

describe("createProject duplicate prevention", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "a".repeat(64));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects project creation if project with same projectKey exists in the same client", async () => {
    db.findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      clientId: "client-1",
      projectKey: "store-us"
    });

    await expect(
      createProject({
        clientId: "client-1",
        projectKey: "store-us",
        displayName: "Store US",
        createdBy: "admin"
      })
    ).rejects.toThrow('A project with key "store-us" already exists in this organization.');
  });

  it("rejects project creation case-insensitively if project with same projectKey exists", async () => {
    db.findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      clientId: "client-1",
      projectKey: "STORE-US"
    });

    await expect(
      createProject({
        clientId: "client-1",
        projectKey: "store-us",
        displayName: "Store US",
        createdBy: "admin"
      })
    ).rejects.toThrow('A project with key "store-us" already exists in this organization.');
  });

  it("rejects project creation if project with same projectKey exists in another client", async () => {
    db.findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      clientId: "other-client",
      projectKey: "store-us"
    });

    await expect(
      createProject({
        clientId: "client-1",
        projectKey: "store-us",
        displayName: "Store US",
        createdBy: "admin"
      })
    ).rejects.toThrow('A project with key "store-us" already exists.');
  });

  it("rejects duplicate Shopify store domain within the same client", async () => {
    db.findOne
      .mockResolvedValueOnce(null) // no existing by key
      .mockResolvedValueOnce({
        _id: new ObjectId(),
        clientId: "client-1",
        projectKey: "existing-shopify",
        credentials: { shopify: { storeDomain: "my-store.myshopify.com" } }
      }); // found existing store domain

    await expect(
      createProject({
        clientId: "client-1",
        platform: "shopify",
        projectKey: "new-shopify",
        displayName: "New Shopify",
        shopifyStoreDomain: "my-store.myshopify.com",
        shopifyAdminAccessToken: "token123",
        createdBy: "admin"
      })
    ).rejects.toThrow('A Shopify project with store domain "my-store.myshopify.com" already exists in this organization.');
  });

  it("rejects duplicate BigCommerce store hash within the same client", async () => {
    db.findOne
      .mockResolvedValueOnce(null) // no existing by key
      .mockResolvedValueOnce({
        _id: new ObjectId(),
        clientId: "client-1",
        projectKey: "existing-bc",
        credentials: { bigcommerce: { storeHash: "hash-xyz" } }
      }); // found existing store hash

    await expect(
      createProject({
        clientId: "client-1",
        platform: "bigcommerce",
        projectKey: "new-bc",
        displayName: "New BC",
        bigcommerceStoreHash: "hash-xyz",
        bigcommerceAccessToken: "token123",
        createdBy: "admin"
      })
    ).rejects.toThrow('A BigCommerce project with store hash "hash-xyz" already exists in this organization.');
  });

  it("creates project successfully when no duplicates exist", async () => {
    db.findOne.mockResolvedValueOnce(null); // no duplicate
    db.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

    const created = await createProject({
      clientId: "client-1",
      projectKey: "brand-new-project",
      displayName: "Brand New",
      createdBy: "admin"
    });

    expect(created.projectKey).toBe("brand-new-project");
    expect(created.clientId).toBe("client-1");
  });
});
