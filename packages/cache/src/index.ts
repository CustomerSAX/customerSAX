/**
 * `@csa/cache` — a tiny, resilient key/value cache for the CSA platform.
 *
 * ## What this is for (read `.claude/rules/no-mock-data.md` first)
 * This cache is for PLUMBING and CONFIG ONLY — tenant project configuration,
 * OAuth/identity tokens, rate-limit counters. It MUST NEVER hold rep-facing
 * business data (order state, price, eligibility, customer profile, shipping
 * method, ticket contents, …). Caching business data would let a rep see a
 * stale, plausible-looking value that no longer matches the real backend — the
 * single most-repeated correction in this project. When in doubt, don't cache.
 *
 * ## Backend + graceful degradation
 * Prefers Redis (via the `redis` client, reusing `REDIS_URL`). The client is
 * lazily connected on first use and degraded to `null` on any connection error
 * — mirroring the pattern in `apps/ai-assist/src/memory/working-memory.ts`.
 * When Redis is unset or down, an in-process `Map` with per-key expiry is used
 * instead, so callers keep working (single-instance semantics) without a hard
 * Redis dependency. No operation ever throws for a cache/Redis failure.
 *
 * ## Single-flight
 * `getOrSet` collapses concurrent misses for the same key onto ONE loader call
 * via an in-process `Map<string, Promise>` — the classic single-flight guard.
 * This is per-process (not cross-instance), which is exactly what's needed to
 * stop a burst of concurrent requests on one instance from all hammering the
 * upstream (Mongo lookup + AES decrypt, an OAuth token endpoint, …).
 */

import { createClient } from "redis";
import { createLogger } from "@csa/logger";

const log = createLogger("cache").child({ module: "cache" });

// The redis package's createClient() returns a narrow generic type that doesn't
// assign cleanly to a module-level variable; `any` is intentional here — all
// external access goes through the typed API below. Mirrors working-memory.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClientAny = any;

let _client: RedisClientAny = null;
let _connecting = false;
/**
 * Circuit breaker: epoch-ms until which we skip connect attempts entirely after
 * a failure. Without it, an unreachable REDIS_URL costs one full `connectTimeout`
 * on EVERY `getClient()` call — and `getOrSet` calls `getClient()` twice (get +
 * set), so a single cached read would eat two connect timeouts back-to-back.
 * After a failed connect we open the breaker for a short cooldown so subsequent
 * calls (and the second half of the same `getOrSet`) degrade INSTANTLY.
 */
let _connectDisabledUntil = 0;
const CONNECT_COOLDOWN_MS = 10_000;

/**
 * Returns a connected Redis client if `REDIS_URL` is configured and reachable,
 * otherwise `null` ("Redis unavailable — use the in-memory fallback").
 *
 * Fail-fast contract: a dead/unreachable host must never hang a request. One
 * bounded connect attempt (`connectTimeout`, no in-client reconnect loop, no
 * offline command queue) probes the host; on failure the circuit opens for
 * `CONNECT_COOLDOWN_MS` so the very next calls skip the probe and use the
 * in-memory fallback immediately. The breaker self-heals: once the cooldown
 * lapses a fresh attempt is made, so a recovered Redis is picked back up.
 */
async function getClient(): Promise<RedisClientAny | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (_client?.isReady) return _client;

  if (_connecting) return null; // avoid concurrent connect races
  if (Date.now() < _connectDisabledUntil) return null; // circuit open — fail fast

  try {
    _connecting = true;
    const client = createClient({
      url,
      // FAIL FAST — bound the connect and take a single shot. `reconnectStrategy:
      // () => false` disables the in-client reconnect loop (the circuit breaker
      // above manages retry timing instead), and `disableOfflineQueue` makes
      // commands fail immediately rather than queueing while disconnected — the
      // exact multi-second hang we must avoid.
      socket: {
        connectTimeout: 1000,
        reconnectStrategy: () => false,
      },
      disableOfflineQueue: true,
    });
    client.on("error", (err: Error) => {
      log.warn("Redis error — cache falling back to in-memory", { reason: err.message });
      _client = null;
    });
    await client.connect();
    _client = client;
    _connectDisabledUntil = 0; // healthy — close the breaker
    return _client;
  } catch (err) {
    log.warn("Redis connect failed (non-fatal) — using in-memory cache", {
      reason: (err as Error).message,
    });
    _client = null;
    _connectDisabledUntil = Date.now() + CONNECT_COOLDOWN_MS; // open the breaker
    return null;
  } finally {
    _connecting = false;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback: Map + per-key expiry
// ---------------------------------------------------------------------------

interface MemEntry {
  value: string;
  expiresAt: number; // epoch ms
}

const memStore = new Map<string, MemEntry>();

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number): void {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ---------------------------------------------------------------------------
// Single-flight registry — collapses concurrent misses per key
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inflight = new Map<string, Promise<any>>();

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Reads and JSON-parses a cached value, or `null` when absent/expired.
 * Never throws — a Redis failure degrades to the in-memory store.
 */
export async function get<T>(key: string): Promise<T | null> {
  const client = await getClient();
  if (client) {
    try {
      const raw = await client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      log.warn("get failed (non-fatal) — trying in-memory", { key, reason: (err as Error).message });
    }
  }
  const raw = memGet(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

/**
 * JSON-serialises and stores a value with a TTL (seconds). Never throws.
 * A `ttlSeconds <= 0` is treated as "do not cache" (no-op) to keep callers safe.
 */
export async function set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return;
  const raw = JSON.stringify(value);
  const client = await getClient();
  if (client) {
    try {
      await client.set(key, raw, { EX: Math.ceil(ttlSeconds) });
      return;
    } catch (err) {
      log.warn("set failed (non-fatal) — using in-memory", { key, reason: (err as Error).message });
    }
  }
  memSet(key, raw, ttlSeconds);
}

/**
 * Deletes a key from both Redis (if reachable) and the in-memory fallback.
 * Never throws — used by invalidation paths (e.g. admin project update).
 */
export async function del(key: string): Promise<void> {
  memStore.delete(key);
  const client = await getClient();
  if (client) {
    try {
      await client.del(key);
    } catch (err) {
      log.warn("del failed (non-fatal)", { key, reason: (err as Error).message });
    }
  }
}

/**
 * The primary API. Returns the cached value for `key`, or runs `loader`, stores
 * its result for `ttlSeconds`, and returns it.
 *
 * Single-flight: while a loader is in progress for a key, concurrent callers on
 * the same process share that one in-flight promise instead of each running the
 * loader. This guarantees a burst of concurrent misses triggers exactly one
 * loader call (and one cache read) per process.
 *
 * NOTE: `getOrSet` is deliberately NOT `async` — the in-flight registration
 * happens synchronously before the first `await`, so two callers arriving in the
 * same tick can never both slip past the dedup check.
 *
 * `ttlSeconds` may be a fixed number or a function of the loaded value — the
 * latter lets a caller derive the TTL from the payload itself (e.g. an OAuth
 * token's own `expires_in`) while keeping the single-flight guarantee.
 */
export function getOrSet<T>(
  key: string,
  ttlSeconds: number | ((value: T) => number),
  loader: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const cached = await get<T>(key);
      if (cached !== null && cached !== undefined) return cached;

      const value = await loader();
      // Only cache non-null values — a null/undefined loader result is treated
      // as "nothing to cache" so a transient upstream miss isn't pinned.
      if (value !== null && value !== undefined) {
        const ttl = typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds;
        await set(key, value, ttl);
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Fixed-window counter primitive for rate limiting. Atomically increments the
 * counter at `key` and, on the first hit of a new window, sets its expiry to
 * `windowSeconds`. Returns the post-increment count, or `null` when Redis is
 * unavailable — callers MUST treat `null` as "degrade open" (allow the request)
 * rather than blocking on a cache outage.
 *
 * Deliberately Redis-only (no in-memory fallback): a per-instance in-memory
 * counter would silently under-count a multi-instance deployment, so when Redis
 * is down we explicitly signal "no shared counter available" via `null`.
 */
export async function incrementFixedWindow(
  key: string,
  windowSeconds: number
): Promise<number | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const count: number = await client.incr(key);
    if (count === 1) {
      await client.expire(key, Math.ceil(windowSeconds));
    }
    return count;
  } catch (err) {
    log.warn("incrementFixedWindow failed (non-fatal) — degrading open", {
      key,
      reason: (err as Error).message,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Namespaced key helpers — the single source of truth for cache key shapes so
// producers and invalidators can never drift.
// ---------------------------------------------------------------------------

/** Per-tenant commercetools project config (Mongo lookup + AES decrypt). */
export function ctProjectConfig(clientId: string, projectKey: string): string {
  return `ct:projectcfg:${clientId}:${projectKey}`;
}

/** commercetools OAuth client-credentials access token, per project+client. */
export function ctToken(projectKey: string, clientId: string): string {
  return `ct:token:${projectKey}:${clientId}`;
}

/** BFF → subgraph GCP identity token, keyed by audience origin. */
export function bffIdentityToken(audience: string): string {
  return `bff:idtoken:${audience}`;
}

/** ai-assist per-user chat rate-limit counter. */
export function aiChatRateLimit(userKey: string): string {
  return `ai:chat:ratelimit:${userKey}`;
}

/** auth failed-login fixed-window counter, per client IP. */
export function authLoginFailByIp(ip: string): string {
  return `auth:login:fail:ip:${ip}`;
}

/** auth failed-login fixed-window counter, per normalized account email. */
export function authLoginFailByEmail(email: string): string {
  return `auth:login:fail:email:${email}`;
}
