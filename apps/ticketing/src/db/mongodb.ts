import { env, getMongoCollection } from "@csa/mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("ticketing").child({ module: "db/mongodb" });

// Ensure the uniqueness index is created at most once per process. The promise
// is cached; on failure it is reset so a later call can retry.
let indexPromise: Promise<void> | undefined;

export async function getTicketsCollection() {
  const dbName = env("MONGO_DB_NAME") || env("MONGO_TICKETS_DB") || "csa";
  const collectionName = env("MONGO_TICKETS_COLLECTION") || "Tickets";

  const collection = await getMongoCollection(collectionName, { dbName });
  await ensureTicketIndexes(collection);

  return collection;
}

/**
 * Creates a UNIQUE partial index on `{ projectKey, ticketNumber }` so a
 * duplicate ticket number within a project is rejected at the database level —
 * defense-in-depth behind the atomic counter in `ticket-number.ts`. Partial so
 * legacy documents without a `ticketNumber` don't collide on a null key.
 *
 * Best-effort and non-fatal: if the index can't be created (e.g. pre-existing
 * duplicate ticket numbers from the old random generator), we log and continue
 * rather than take the ticketing service down. The counter still guarantees
 * uniqueness for all new tickets.
 */
async function ensureTicketIndexes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: { createIndex: (...args: any[]) => Promise<unknown> }
): Promise<void> {
  if (!indexPromise) {
    indexPromise = collection
      .createIndex(
        { projectKey: 1, ticketNumber: 1 },
        {
          unique: true,
          partialFilterExpression: { ticketNumber: { $exists: true } },
          background: true,
          name: "uniq_project_ticketNumber"
        }
      )
      .then(() => undefined)
      .catch((err: Error) => {
        indexPromise = undefined; // allow a retry on the next call
        log.warn("could not create unique ticketNumber index (non-fatal)", { reason: err.message });
      });
  }

  return indexPromise;
}
