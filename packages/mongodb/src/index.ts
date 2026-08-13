import { setServers } from "node:dns";
import { MongoClient, type Collection, type Document } from "mongodb";

export type { Collection, Db, Document, Filter, Sort } from "mongodb";
export { ObjectId } from "mongodb";

let clientPromise: Promise<MongoClient> | undefined;
let dnsConfigured = false;

export async function getMongoClient(uri = mongoUri()) {
  if (!clientPromise) {
    configureDns();
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

function configureDns() {
  if (dnsConfigured) return;

  const servers = env("MONGO_DNS_SERVERS")
    ?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers?.length) {
    setServers(servers);
  }

  dnsConfigured = true;
}

export async function getMongoDb(dbName = env("MONGO_DB_NAME") || "csa") {
  const client = await getMongoClient();

  return client.db(dbName);
}

export async function getMongoCollection<TSchema extends Document = Document>(
  collectionName: string,
  options: { dbName?: string } = {}
): Promise<Collection<TSchema>> {
  const db = await getMongoDb(options.dbName);

  return db.collection<TSchema>(collectionName);
}

export function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

export function requiredEnv(name: string) {
  const value = env(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function mongoUri() {
  const value = env("MONGO_URI") || env("MONGODB_URI");

  if (!value) {
    throw new Error("Missing required environment variable: MONGO_URI or MONGODB_URI");
  }

  return value;
}
