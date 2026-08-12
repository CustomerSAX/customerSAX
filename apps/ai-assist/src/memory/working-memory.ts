/**
 * Redis-backed working memory for active AI conversation sessions.
 *
 * Working memory holds the AI's live understanding of the current conversation:
 * the customer's goal, inferred intent, detected sentiment, proposed strategy,
 * and suggested next steps. It is written at the end of each turn (via onFinish
 * extracting the update_ui_state tool call) and read at the start of the next
 * turn to inject context into the dynamic system prompt.
 *
 * ## Storage
 * Each session maps to a Redis hash at `session:wm:{sessionId}`.
 * The hash TTL defaults to 24 hours — enough for a full shift's context.
 *
 * ## Resilience
 * All operations degrade gracefully when Redis is not configured (REDIS_URL
 * unset) or unavailable (connection error). They return null/undefined rather
 * than throwing, so a Redis outage never breaks the main chat flow.
 */

import { createClient } from "redis";

// The redis package's createClient() returns a narrow generic type that doesn't
// assign cleanly to a module-level variable typed with the broader default generics.
// Using `any` here is intentional — all external access is through the typed API below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClientAny = any;

/** Typed shape of all fields persisted in the working memory hash. */
export interface WorkingMemoryRecord {
  /** Customer's primary goal or issue in plain English */
  activeGoal: string | null;
  /** Inferred intent label, e.g. "order_status", "refund_request" */
  currentIntent: string | null;
  /** Detected sentiment label, e.g. "positive", "frustrated" */
  currentSentiment: string | null;
  /** Proposed resolution strategy in plain English */
  currentStrategy: string | null;
  /** Ordered list of suggested next steps for the agent */
  nextSteps: string[];
  /** ISO-8601 timestamp of the last write */
  lastUpdated: string | null;
}

/** Default TTL: 24 hours — covers a full agent shift. */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const HASH_PREFIX = "session:wm:";

/** Module-level singleton — created once, reused across requests. */
let _client: RedisClientAny = null;
let _connecting = false;

/**
 * Returns a connected Redis client if REDIS_URL is configured, otherwise null.
 * Null means "Redis unavailable — skip memory operations silently."
 */
async function getClient(): Promise<RedisClientAny | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (_client?.isReady) return _client;

  if (_connecting) return null; // avoid concurrent connect races

  try {
    _connecting = true;
    const client = createClient({ url });
    client.on("error", (err: Error) => {
      console.warn("[memory/working] Redis error — working memory disabled:", err.message);
      _client = null;
    });
    await client.connect();
    _client = client;
    return _client;
  } catch (err) {
    console.warn("[memory/working] Redis connect failed (non-fatal):", (err as Error).message);
    _client = null;
    return null;
  } finally {
    _connecting = false;
  }
}

/**
 * Reads the full working memory record for a session.
 * Returns null if Redis is unavailable or the session has no memory yet.
 */
export async function getWorkingMemory(
  sessionId: string
): Promise<WorkingMemoryRecord | null> {
  try {
    const client = await getClient();
    if (!client) return null;

    const data = await client.hGetAll(`${HASH_PREFIX}${sessionId}`);
    if (!data || Object.keys(data).length === 0) return null;

    return {
      activeGoal: data.activeGoal ?? null,
      currentIntent: data.currentIntent ?? null,
      currentSentiment: data.currentSentiment ?? null,
      currentStrategy: data.currentStrategy ?? null,
      nextSteps: data.nextSteps ? (JSON.parse(data.nextSteps) as string[]) : [],
      lastUpdated: data.lastUpdated ?? null,
    };
  } catch (err) {
    console.warn("[memory/working] getWorkingMemory error (non-fatal):", (err as Error).message);
    return null;
  }
}

/**
 * Writes (upserts) working memory for a session.
 * Existing fields are merged — only explicitly provided fields are overwritten.
 */
export async function setWorkingMemory(
  sessionId: string,
  record: Partial<WorkingMemoryRecord>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;

    const key = `${HASH_PREFIX}${sessionId}`;
    const fields: Record<string, string> = {};

    if (record.activeGoal !== undefined) fields.activeGoal = record.activeGoal ?? "";
    if (record.currentIntent !== undefined) fields.currentIntent = record.currentIntent ?? "";
    if (record.currentSentiment !== undefined) fields.currentSentiment = record.currentSentiment ?? "";
    if (record.currentStrategy !== undefined) fields.currentStrategy = record.currentStrategy ?? "";
    if (record.nextSteps !== undefined) fields.nextSteps = JSON.stringify(record.nextSteps);
    if (record.lastUpdated !== undefined) fields.lastUpdated = record.lastUpdated ?? "";

    if (Object.keys(fields).length === 0) return;

    await client.hSet(key, fields);
    await client.expire(key, ttlSeconds);
  } catch (err) {
    console.warn("[memory/working] setWorkingMemory error (non-fatal):", (err as Error).message);
  }
}

/**
 * Deletes the working memory for a session.
 * Called when "New Conversation" clears the session.
 */
export async function clearWorkingMemory(sessionId: string): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    await client.del(`${HASH_PREFIX}${sessionId}`);
  } catch (err) {
    console.warn("[memory/working] clearWorkingMemory error (non-fatal):", (err as Error).message);
  }
}

/**
 * Formats the working memory record as a compact prompt context block.
 * Returns an empty string when the record is null or empty.
 */
export function formatWorkingMemoryForPrompt(record: WorkingMemoryRecord | null): string {
  if (!record) return "";
  const lines: string[] = [];
  if (record.activeGoal) lines.push(`Goal: ${record.activeGoal}`);
  if (record.currentIntent) lines.push(`Intent: ${record.currentIntent}`);
  if (record.currentSentiment) lines.push(`Sentiment: ${record.currentSentiment}`);
  if (record.currentStrategy) lines.push(`Strategy: ${record.currentStrategy}`);
  if (record.nextSteps.length) lines.push(`Next steps: ${record.nextSteps.join(" | ")}`);
  if (lines.length === 0) return "";
  return `\n\n--- Conversation Working Memory (from previous turn) ---\n${lines.join("\n")}\n---`;
}
