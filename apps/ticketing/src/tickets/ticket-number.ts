/**
 * Ticket-number generation.
 *
 * Two paths, matching the repository's two storage modes:
 *  - `nextTicketNumber(projectKey)` — the durable, collision-free generator used
 *    for the real Mongo store. It draws from an atomic per-project counter
 *    (`counters` collection, `findOneAndUpdate($inc)`), so two tickets created
 *    concurrently can never receive the same sequence value. Combined with the
 *    unique index on `{projectKey, ticketNumber}` (see `db/mongodb.ts`), a
 *    duplicate is impossible rather than merely unlikely.
 *  - `generateTicketNumber()` — the random-suffix fallback used ONLY by the
 *    in-memory store (MONGO_URI unset in dev), where there is no durable counter.
 *
 * Format: `CSA-{YYYYMMDD}-{seq}` (seq zero-padded to 5 digits for the counter
 * path; a 5-char base36 suffix for the memory fallback).
 */

import { env, getMongoCollection, type Document } from "@csa/mongodb";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateStamp(date = new Date()): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/**
 * Random-suffix ticket number — used only by the in-memory store fallback,
 * where there is no durable counter to draw from.
 */
export function generateTicketNumber() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CSA-${dateStamp()}-${suffix}`;
}

type CounterDoc = Document & { _id: string; seq: number };

async function getCountersCollection() {
  const dbName = env("MONGO_DB_NAME") || env("MONGO_TICKETS_DB") || "csa";
  const collectionName = env("MONGO_TICKETS_COUNTERS_COLLECTION") || "counters";

  return getMongoCollection<CounterDoc>(collectionName, { dbName });
}

/**
 * Collision-free ticket number backed by an atomic Mongo counter. Each call
 * performs a single `findOneAndUpdate({ _id: 'ticket:<projectKey>' }, { $inc:
 * { seq: 1 } }, { upsert, returnDocument: 'after' })`, so concurrent creators
 * are handed strictly increasing, unique sequence values.
 */
export async function nextTicketNumber(projectKey: string): Promise<string> {
  const counters = await getCountersCollection();
  const updated = await counters.findOneAndUpdate(
    { _id: `ticket:${projectKey}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  // Driver v6+ returns the document directly; guard defensively for the legacy
  // `{ value }` envelope just in case.
  const seq =
    (updated as CounterDoc | null)?.seq ??
    (updated as { value?: CounterDoc } | null)?.value?.seq;

  if (typeof seq !== "number") {
    throw new Error("Ticket counter did not return a sequence value");
  }

  return `CSA-${dateStamp()}-${String(seq).padStart(5, "0")}`;
}
