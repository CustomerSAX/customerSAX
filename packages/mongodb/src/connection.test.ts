import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ clients: [] as Array<{ uri: string; connect: ReturnType<typeof vi.fn>; db: ReturnType<typeof vi.fn> }> }));
vi.mock("mongodb", () => ({ MongoClient: class {
  uri: string;
  connect = vi.fn(async () => this);
  db = vi.fn((name: string) => ({ collection: (collection: string) => ({ name, collection, uri: this.uri }) }));
  constructor(uri: string) { this.uri = uri; mocks.clients.push(this); }
} }));
vi.mock("@csa/config", () => ({ setupDnsFallback: vi.fn(), env: (key: string) => key === "MONGO_URI" ? "native-uri" : undefined, requiredEnv: vi.fn() }));
import { getMongoClient, getMongoCollection } from "./connection.js";
it("reuses each connection independently and routes explicit admin reads to the settings cluster", async () => {
  const native = await getMongoClient("native-uri");
  const admin = await getMongoClient("admin-uri");
  expect(native).not.toBe(admin);
  expect(await getMongoClient("native-uri")).toBe(native);
  expect(await getMongoClient("admin-uri")).toBe(admin);
  expect(mocks.clients).toHaveLength(2);
  expect(await getMongoCollection("csa_projects", { uri: "admin-uri", dbName: "csa-admin" })).toEqual({ uri: "admin-uri", name: "csa-admin", collection: "csa_projects" });
  expect(await getMongoCollection("tickets", { dbName: "csa-tickets" })).toEqual({ uri: "native-uri", name: "csa-tickets", collection: "tickets" });
});
