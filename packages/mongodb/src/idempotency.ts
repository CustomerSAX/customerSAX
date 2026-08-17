/**
 * Durable idempotency keys for exactly-once write operations.
 *
 * Motivating problem: a double-submit (rep double-clicks "Place order", the
 * client retries a slow request) must not execute a money-moving write twice.
 * An in-memory flag can't guarantee that across retries, restarts, or multiple
 * instances — so the guard is durable in Mongo.
 *
 * Mechanism: an `idempotency_keys` collection with a UNIQUE index on `key`.
 * The first caller for a key wins an atomic `insertOne` (a claim), runs the
 * operation exactly once, and stores its result. Any concurrent or later caller
 * for the same key hits a duplicate-key error (E11000) on insert and REPLAYS
 * the stored record instead of re-executing. If the winning caller's operation
 * throws, its claim is released so a genuine retry can proceed.
 *
 * The key should be derived by the caller from the operation + the resource it
 * mutates (e.g. `place_order:<projectKey>:<cartId>`), so identical double
 * submits collapse while distinct operations stay independent.
 */

import { env, getMongoCollection } from "./connection.js";
import type { Collection, Document } from "mongodb";

export type IdempotencyStatus = "pending" | "completed";

export interface IdempotencyOutcome<T> {
  /** True when a prior record was replayed instead of executing `exec`. */
  replayed: boolean;
  /**
   * `completed` once the operation's result is durably stored. `pending` only
   * when a duplicate arrived while the original was still in flight (its result
   * isn't available yet) — callers should treat that as "already in progress".
   */
  status: IdempotencyStatus;
  /**
   * The operation result: the fresh result on first execution, or the stored
   * result when replaying a completed record. `null` when replaying a still
   * `pending` record, or when the guard was skipped because Mongo is not
   * configured (see below).
   */
  result: T | null;
  /**
   * True when Mongo is not configured (`MONGO_URI` unset) and the operation was
   * executed directly WITHOUT a durable guard — preserving prior behaviour
   * (which had no idempotency at all) rather than failing the write.
   */
  unguarded?: boolean;
}

interface IdempotencyDoc extends Document {
  key: string;
  operation: string;
  status: IdempotencyStatus;
  result?: unknown;
  createdAt: Date;
  completedAt?: Date;
}

let indexPromise: Promise<void> | undefined;

async function getIdempotencyCollection(): Promise<Collection<IdempotencyDoc>> {
  const dbName = env("MONGO_DB_NAME") || "csa";
  const collectionName = env("MONGO_IDEMPOTENCY_COLLECTION") || "idempotency_keys";
  const collection = await getMongoCollection<IdempotencyDoc>(collectionName, { dbName });

  if (!indexPromise) {
    indexPromise = collection
      .createIndex({ key: 1 }, { unique: true, name: "uniq_idempotency_key", background: true })
      .then(() => undefined)
      .catch((err: Error) => {
        indexPromise = undefined; // allow a retry on the next call
        throw err;
      });
  }
  await indexPromise;

  return collection;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/**
 * Runs `exec` at most once per `key`. Returns the fresh result on first
 * execution, or the stored result when a duplicate key replays a prior run.
 *
 * When `MONGO_URI` is unset, the durable guard can't be applied — `exec` runs
 * directly and the outcome is flagged `unguarded` (matching the previous
 * no-idempotency behaviour instead of failing the write).
 */
export async function withIdempotency<T>(params: {
  key: string;
  operation: string;
  exec: () => Promise<T>;
}): Promise<IdempotencyOutcome<T>> {
  const { key, operation, exec } = params;

  if (!env("MONGO_URI")) {
    const result = await exec();
    return { replayed: false, status: "completed", result, unguarded: true };
  }

  const collection = await getIdempotencyCollection();

  try {
    await collection.insertOne({
      key,
      operation,
      status: "pending",
      createdAt: new Date()
    } as IdempotencyDoc);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    // A record already exists for this key — replay it, never re-execute.
    const existing = await collection.findOne({ key });
    return {
      replayed: true,
      status: (existing?.status as IdempotencyStatus) ?? "pending",
      result: (existing?.result ?? null) as T | null
    };
  }

  // We won the claim — execute exactly once and persist the result.
  try {
    const result = await exec();
    await collection.updateOne(
      { key },
      { $set: { status: "completed", result, completedAt: new Date() } }
    );
    return { replayed: false, status: "completed", result };
  } catch (err) {
    // Execution failed — release the claim so a genuine retry can proceed.
    await collection.deleteOne({ key, status: "pending" }).catch(() => {});
    throw err;
  }
}
