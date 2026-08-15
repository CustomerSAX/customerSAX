# @csa/cache

A tiny, resilient key/value cache for the CSA platform. Redis-backed (reusing
`REDIS_URL`) with an in-process `Map`+expiry fallback and graceful degradation
when Redis is unset or down. Source-ESM, like `@csa/config` / `@csa/mongodb`.

## ⚠️ Guardrail: plumbing & config ONLY — never business data

This cache exists for **plumbing and configuration** only:

- tenant commercetools project config (Mongo lookup + AES-decrypt),
- OAuth / GCP identity tokens,
- rate-limit counters.

It **MUST NEVER** hold anything a rep sees — order state, price, return/cancel
eligibility, shipping method, customer profile, cart contents, ticket data, etc.

This is a hard project rule, not a preference. See
[`.claude/rules/no-mock-data.md`](../../.claude/rules/no-mock-data.md): every
value shown to a rep must come from a real, current backend call. A cache of
business data serves a stale-but-plausible value that no longer matches the real
backend — exactly the failure that rule exists to prevent. When in doubt, don't
cache.

## API

```ts
import * as cache from "@csa/cache";

await cache.get<T>(key);                       // T | null (never throws)
await cache.set(key, value, ttlSeconds);       // no-op if ttl <= 0
await cache.del(key);                           // invalidation

// Primary API — single-flight: concurrent misses collapse to ONE loader call.
const cfg = await cache.getOrSet(key, 300, async () => loadFromMongo());

// Fixed-window counter for rate limiting. Returns count, or null when Redis is
// unavailable — callers MUST treat null as "degrade open" (allow).
const count = await cache.incrementFixedWindow(key, windowSeconds);

// Namespaced key helpers (the single source of truth for key shapes):
cache.ctProjectConfig(clientId, projectKey);
cache.ctToken(projectKey, clientId);
cache.bffIdentityToken(audienceOrigin);
cache.aiChatRateLimit(userKey);
```

## Degradation semantics

- **Redis configured + reachable:** all ops use Redis.
- **Redis unset or connection error:** `get`/`set`/`getOrSet`/`del` transparently
  use the in-memory `Map` (single-instance semantics); `incrementFixedWindow`
  returns `null` so rate limiters **degrade open** rather than block on an
  outage.
- No cache/Redis failure ever throws or breaks the calling request.

Single-flight is per-process (not cross-instance) — enough to stop a burst of
concurrent requests on one instance from all hammering the same upstream.
