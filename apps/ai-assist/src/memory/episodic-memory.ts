/**
 * MongoDB-backed episodic memory for CSA agents.
 *
 * Episodic memory records summaries of past AI conversations and customer
 * interactions, giving agents and the AI awareness of repeat contacts,
 * prior resolutions, and recurring issues.
 *
 * ## Collection: `csa_memory`
 * One document per (userEmail, projectKey) pair.
 * Each document holds an array of EpisodicEntry records, newest first.
 *
 * ## Retention
 * - Entries older than RETENTION_DAYS (30) are pruned on every write.
 * - At most MAX_ENTRIES (50) entries are kept per agent per project.
 *
 * ## Resilience
 * All public functions catch and log errors — never throws to the caller,
 * so a MongoDB failure never breaks the chat flow.
 */

import { MongoClient } from "mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("ai-assist").child({ module: "memory/episodic" });

const RETENTION_DAYS = 30;
const MAX_ENTRIES = 50;

/** Discriminated union of entry types stored in episodic memory. */
export type EpisodicEntryType =
  | "session_summary"
  | "ticket_resolution"
  | "customer_interaction";

export interface EpisodicEntry {
  type: EpisodicEntryType;
  /** Human-readable summary of the interaction or outcome. */
  summary: string;
  /** CT customer UUID — present for customer-specific entries. */
  customerId?: string;
  /** Ticket ID — present when the entry relates to a specific ticket. */
  ticketId?: string;
  /** Chat session ID — links back to the full transcript in csa_chat_sessions. */
  sessionId?: string;
  /** Detected customer sentiment at time of entry. */
  sentiment?: string;
  /** Inferred intent label at time of entry. */
  intent?: string;
  /** The resolution strategy that was applied. */
  strategy?: string;
  /** Wall-clock time of the interaction. */
  date: Date;
}

export interface EpisodicMemoryDoc {
  userEmail: string;
  projectKey: string;
  entries: EpisodicEntry[];
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Connection — shares the same MONGO_URI as mongo-chat.ts
// ---------------------------------------------------------------------------

let _clientPromise: Promise<MongoClient> | null = null;

function getMongoClient(): Promise<MongoClient> | null {
  const uri = process.env.MONGO_URI?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) return null;
  if (!_clientPromise) {
    _clientPromise = new MongoClient(uri).connect();
  }
  return _clientPromise;
}

const COLLECTION = "csa_memory";
const DB_NAME = () =>
  process.env.MONGO_DB_NAME?.trim() ||
  process.env.MONGO_TICKETS_DB?.trim() ||
  "csa";

async function getCollection() {
  const clientPromise = getMongoClient();
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db(DB_NAME()).collection<EpisodicMemoryDoc>(COLLECTION);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Appends a new entry to an agent's episodic memory.
 *
 * Uses a MongoDB pipeline update to atomically:
 *   1. Prepend the new entry (newest-first ordering)
 *   2. Filter out entries older than RETENTION_DAYS
 *   3. Slice to MAX_ENTRIES
 */
export async function appendEpisodicEntry(
  userEmail: string,
  projectKey: string,
  entry: EpisodicEntry
): Promise<void> {
  try {
    const col = await getCollection();
    if (!col) return; // MongoDB not configured — skip silently

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1_000);

    // Pipeline update: prepend → filter stale → slice — all in one atomic op.
    await (col.updateOne as (...args: unknown[]) => Promise<unknown>)(
      { userEmail, projectKey },
      [
        {
          $set: {
            userEmail,
            projectKey,
            updatedAt: new Date(),
            entries: {
              $slice: [
                {
                  $filter: {
                    input: {
                      $concatArrays: [[entry], { $ifNull: ["$entries", []] }],
                    },
                    as: "e",
                    cond: { $gte: ["$$e.date", cutoff] },
                  },
                },
                MAX_ENTRIES,
              ],
            },
          },
        },
      ],
      { upsert: true }
    );
  } catch (err) {
    log.warn("appendEpisodicEntry error (non-fatal)", { reason: (err as Error).message });
  }
}

/**
 * Returns the most recent episodic memory entries for an agent.
 */
export async function getEpisodicMemory(
  userEmail: string,
  projectKey: string,
  limit = 10
): Promise<EpisodicEntry[]> {
  try {
    const col = await getCollection();
    if (!col) return [];
    const doc = await col.findOne(
      { userEmail, projectKey },
      { projection: { entries: { $slice: limit }, _id: 0 } }
    );
    return doc?.entries ?? [];
  } catch (err) {
    log.warn("getEpisodicMemory error (non-fatal)", { reason: (err as Error).message });
    return [];
  }
}

/**
 * Returns episodic entries related to a specific CT customer.
 * Searches across all agents in the project for cross-agent awareness.
 */
export async function getCustomerMemory(
  customerId: string,
  projectKey: string,
  limit = 5
): Promise<EpisodicEntry[]> {
  try {
    const col = await getCollection();
    if (!col) return [];

    const results = await col
      .aggregate<EpisodicEntry>([
        { $match: { projectKey, "entries.customerId": customerId } },
        { $unwind: "$entries" },
        { $match: { "entries.customerId": customerId } },
        { $sort: { "entries.date": -1 } },
        { $limit: limit },
        { $replaceRoot: { newRoot: "$entries" } },
      ])
      .toArray();

    return results;
  } catch (err) {
    log.warn("getCustomerMemory error (non-fatal)", { reason: (err as Error).message });
    return [];
  }
}
