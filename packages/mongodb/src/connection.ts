/**
 * MongoDB connection + environment helpers for the CSA data layer.
 *
 * One MongoClient per connection URI is created lazily and reused for the
 * process lifetime. Settings and application data may live in different clusters.
 *
 * Environment contract:
 *  - `MONGO_URI` is the single canonical connection-string variable and is set
 *    in every service's `.env`. It has no fallback alias — see {@link mongoUri}.
 *  - `MONGO_DB_NAME` selects the default database (`csa` when unset).
 */

import { env, requiredEnv, setupDnsFallback } from "@csa/config";
import { MongoClient, type Collection, type Document } from "mongodb";

// `env`/`requiredEnv`/`setupDnsFallback` live in `@csa/config`; re-exported for convenience
export { env, requiredEnv, setupDnsFallback };

const clients = new Map<string, Promise<MongoClient>>();

/**
 * Returns the shared, connected `MongoClient`, establishing the connection on
 * first call and reusing the cached connect promise thereafter.
 */
export async function getMongoClient(uri = mongoUri()) {
  setupDnsFallback();
  let clientPromise = clients.get(uri);
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect().catch((err) => {
      clients.delete(uri); // Reset on failure
      throw err;
    });
    clients.set(uri, clientPromise);
  }

  return clientPromise;
}

/** Resolves a `Db` handle, defaulting to `MONGO_DB_NAME` (or `csa`). */
export async function getMongoDb(dbName = env("MONGO_DB_NAME") || "csa") {
  const client = await getMongoClient();

  return client.db(dbName);
}

/** Resolves a typed `Collection` handle, optionally overriding the database. */
export async function getMongoCollection<TSchema extends Document = Document>(
  collectionName: string,
  options: { dbName?: string; uri?: string } = {}
): Promise<Collection<TSchema>> {
  const db = options.uri
    ? (await getMongoClient(options.uri)).db(options.dbName || env("MONGO_DB_NAME") || "csa")
    : await getMongoDb(options.dbName);

  return db.collection<TSchema>(collectionName);
}

/**
 * Resolves the canonical `MONGO_URI` connection string.
 *
 * `MONGO_URI` is the one supported name (set in every service's `.env`); there
 * is deliberately no `MONGODB_URI` fallback so the configuration surface stays
 * unambiguous across services.
 */
function mongoUri() {
  const value = env("MONGO_URI");

  if (!value) {
    throw new Error("Missing required environment variable: MONGO_URI");
  }

  return value;
}
