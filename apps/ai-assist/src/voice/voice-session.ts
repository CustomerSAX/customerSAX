/**
 * Voice session state.
 *
 * Each spoken turn is a separate HTTP request, and Cloud Run may route them to
 * different instances, so everything a turn depends on (transcript, the
 * caller's verified identity, attempt and turn counters) lives in Redis under
 * `voice:session:{id}` — not in process memory.
 *
 * FAIL-CLOSED: unlike chat's working memory, voice state is security state
 * (who the caller proved they are, how many verification attempts remain). In
 * production a Redis outage refuses voice sessions rather than silently losing
 * verification. Only local dev without REDIS_URL falls back to an in-process
 * Map, mirroring how the rest of ai-assist degrades in dev.
 *
 * This deliberately does not use `@csa/cache`: that package is reserved for
 * config/plumbing and must never hold business data (see its header), and a
 * transcript is business data.
 *
 * Each turn also upserts a record into the Mongo `csa_voice_sessions`
 * collection (when Mongo is configured) — the durable audit trail of what the
 * caller said, what the agent did, and the outcome.
 */

import { randomBytes } from "node:crypto";
import { createClient } from "redis";
import { getMongoCollection } from "@csa/mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("ai-assist").child({ module: "voice/session" });

export const SESSION_TTL_SECONDS = 30 * 60;
const TURN_LOCK_TTL_SECONDS = 90;
const KEY_PREFIX = "voice:session:";
const LOCK_PREFIX = "voice:lock:";

export interface VoiceTranscriptEntry {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface VoiceToolEvent {
  tool: string;
  ok: boolean;
  at: string;
}

export interface VoiceSession {
  id: string;
  widgetKey: string;
  projectKey: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
  transcript: VoiceTranscriptEntry[];
  /** Set only by a successful `verify_caller` — the order's own email, never caller-typed text. */
  verified: { email: string; customerId: string | null; orderNumber: string | null } | null;
  verifyAttempts: number;
  turns: number;
  toolEvents: VoiceToolEvent[];
  ticket: { id: string | null; ticketNumber: string | null } | null;
  ended: boolean;
  outcome: "in_progress" | "resolved" | "handoff" | "abandoned";
}

export class VoiceStoreUnavailableError extends Error {
  constructor() {
    super("Voice session store (Redis) is unavailable");
  }
}

// ---------------------------------------------------------------------------
// Redis client — one shared connect promise so concurrent first requests wait
// for the same connection instead of seeing a spurious "unavailable".
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClientAny = any;

let clientPromise: Promise<RedisClientAny> | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
}

/** Returns a connected client, `null` for the dev in-memory store, or throws when Redis is required but down. */
async function getStore(): Promise<RedisClientAny | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    if (isProduction()) throw new VoiceStoreUnavailableError();
    return null;
  }
  if (!clientPromise) {
    const client = createClient({
      url,
      socket: { connectTimeout: 2000, reconnectStrategy: () => false },
      disableOfflineQueue: true
    });
    client.on("error", (err: Error) => {
      log.warn("Redis error — voice sessions unavailable until reconnect", { reason: err.message });
      clientPromise = null;
    });
    clientPromise = client.connect().then(() => client);
  }
  try {
    const client = await clientPromise;
    if (!client.isReady) throw new Error("not ready");
    return client;
  } catch (err) {
    clientPromise = null;
    log.warn("Redis connect failed — refusing voice session", { reason: (err as Error).message });
    throw new VoiceStoreUnavailableError();
  }
}

const memSessions = new Map<string, { value: string; expiresAt: number }>();
const memLocks = new Map<string, number>();
let warnedDevStore = false;

function devStoreWarning() {
  if (warnedDevStore) return;
  warnedDevStore = true;
  log.warn("REDIS_URL not set — voice sessions use an in-process store (dev only, single instance)");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export async function saveSession(session: VoiceSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  const raw = JSON.stringify(session);
  const client = await getStore();
  if (client) {
    await client.set(KEY_PREFIX + session.id, raw, { EX: SESSION_TTL_SECONDS });
    return;
  }
  devStoreWarning();
  memSessions.set(session.id, { value: raw, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
}

export async function loadSession(id: string): Promise<VoiceSession | null> {
  const client = await getStore();
  let raw: string | null = null;
  if (client) {
    raw = await client.get(KEY_PREFIX + id);
  } else {
    const entry = memSessions.get(id);
    if (entry && entry.expiresAt > Date.now()) raw = entry.value;
    else memSessions.delete(id);
  }
  return raw ? (JSON.parse(raw) as VoiceSession) : null;
}

/** Serialises turns within one session so two requests can't race the verification counters. */
export async function acquireTurnLock(id: string): Promise<boolean> {
  const client = await getStore();
  if (client) {
    const ok = await client.set(LOCK_PREFIX + id, "1", { NX: true, EX: TURN_LOCK_TTL_SECONDS });
    return ok === "OK";
  }
  const heldUntil = memLocks.get(id);
  if (heldUntil && heldUntil > Date.now()) return false;
  memLocks.set(id, Date.now() + TURN_LOCK_TTL_SECONDS * 1000);
  return true;
}

export async function releaseTurnLock(id: string): Promise<void> {
  try {
    const client = await getStore();
    if (client) await client.del(LOCK_PREFIX + id);
    else memLocks.delete(id);
  } catch {
    // The lock expires on its own TTL.
  }
}

/**
 * Upserts the session's audit record into Mongo. Non-fatal: the call itself
 * must not fail because the archive is down, but the failure is logged.
 */
export async function archiveSession(session: VoiceSession): Promise<void> {
  const uri = process.env.MONGO_URI?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) return;
  try {
    const col = await getMongoCollection("csa_voice_sessions", {
      uri,
      dbName: process.env.MONGO_DB_NAME?.trim() || process.env.MONGO_TICKETS_DB?.trim() || "csa"
    });
    await col.updateOne(
      { sessionId: session.id },
      {
        $set: {
          sessionId: session.id,
          widgetKey: session.widgetKey,
          projectKey: session.projectKey,
          clientId: session.clientId ?? null,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          transcript: session.transcript,
          verifiedEmail: session.verified?.email ?? null,
          verifiedCustomerId: session.verified?.customerId ?? null,
          turns: session.turns,
          toolEvents: session.toolEvents,
          ticket: session.ticket,
          outcome: session.outcome
        }
      },
      { upsert: true }
    );
  } catch (err) {
    log.warn("voice session archive failed (non-fatal)", { reason: (err as Error).message });
  }
}
