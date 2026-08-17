/**
 * MongoDB connection + environment helpers for the CSA data layer.
 *
 * A single `MongoClient` is created lazily on first use and its connect promise
 * is cached for the lifetime of the process, so every service (`apps/auth`,
 * `apps/admin`, `apps/commerce/commercetools`, `apps/ticketing`) shares one
 * pooled connection to the live Atlas cluster rather than reconnecting per call.
 *
 * Environment contract:
 *  - `MONGO_URI` is the single canonical connection-string variable and is set
 *    in every service's `.env`. It has no fallback alias — see {@link mongoUri}.
 *  - `MONGO_DB_NAME` selects the default database (`csa` when unset).
 */

import { env, requiredEnv } from "@csa/config";
import { MongoClient, type Collection, type Document } from "mongodb";

// `env`/`requiredEnv` now live in the lower-level `@csa/config` package; they are
// re-exported here so existing `@csa/mongodb` consumers keep importing them
// unchanged (the barrel `export * from "./connection.js"` forwards these).
export { env, requiredEnv };

let clientPromise: Promise<MongoClient> | undefined;

/**
 * Returns the shared, connected `MongoClient`, establishing the connection on
 * first call and reusing the cached connect promise thereafter.
 */
export async function getMongoClient(uri = mongoUri()) {
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
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
  options: { dbName?: string } = {}
): Promise<Collection<TSchema>> {
  const db = await getMongoDb(options.dbName);

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
