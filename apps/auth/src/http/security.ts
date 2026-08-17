import type { IncomingMessage, ServerResponse } from "node:http";
import {
  authLoginFailByEmail,
  authLoginFailByIp,
  get as cacheGet,
  incrementFixedWindow
} from "@csa/cache";
import { createLogger } from "@csa/logger";

const log = createLogger("auth").child({ module: "security" });

// ---------------------------------------------------------------------------
// Client IP resolution (Cloud Run sits behind a proxy)
// ---------------------------------------------------------------------------

/**
 * Best-effort real client IP. Cloud Run terminates TLS at a front-end proxy and
 * sets `x-forwarded-for` as a comma-separated chain (`client, proxy1, proxy2`),
 * so the ORIGINAL client is the FIRST hop. We fall back to the socket address
 * for direct (non-proxied) connections. This is used only for abuse throttling —
 * never for authorization — so a spoofed header at worst throttles the spoofer.
 */
export function getClientIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (raw) {
    const firstHop = raw.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }
  return request.socket?.remoteAddress ?? "unknown";
}

// ---------------------------------------------------------------------------
// CORS / preflight
// ---------------------------------------------------------------------------

let _corsOriginsCache: { raw: string; set: Set<string> } | null = null;

/** Parsed `AUTH_CORS_ORIGINS` allowlist (comma-separated). Empty => deny all cross-origin. */
function allowedOrigins(): Set<string> {
  const raw = process.env.AUTH_CORS_ORIGINS?.trim() ?? "";
  if (!_corsOriginsCache || _corsOriginsCache.raw !== raw) {
    const set = new Set(
      raw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    );
    _corsOriginsCache = { raw, set };
  }
  return _corsOriginsCache.set;
}

/**
 * Applies conservative CORS headers when the request carries an `Origin` header
 * that is on the env allowlist. Returns the resolved origin (or null).
 *
 * IMPORTANT: the studio calls this service SERVER-SIDE (Next.js route handlers),
 * which send NO `Origin` header — that path is untouched here (we only add
 * headers when an allowlisted Origin is present). Direct browser cross-origin
 * calls from a non-allowlisted origin simply get no CORS headers, so the
 * browser blocks the response.
 */
export function applyCors(request: IncomingMessage, response: ServerResponse): string | null {
  const origin = request.headers.origin;
  if (!origin) return null; // server-side / same-origin — nothing to do

  if (!allowedOrigins().has(origin)) return null; // not allowlisted — no CORS grant

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
  response.setHeader("Access-Control-Max-Age", "600");
  return origin;
}

/**
 * Handles an OPTIONS preflight. Responds 204 with CORS headers when the Origin
 * is allowlisted, otherwise 403 with no CORS grant. Returns true if it handled
 * the request (caller should stop).
 */
export function handlePreflight(request: IncomingMessage, response: ServerResponse): boolean {
  if (request.method !== "OPTIONS") return false;
  const origin = applyCors(request, response);
  if (origin) {
    response.writeHead(204, { "cache-control": "no-store" });
  } else {
    // Unknown/absent origin on a preflight — deny cross-origin explicitly.
    response.writeHead(403, { "cache-control": "no-store" });
  }
  response.end();
  return true;
}

// ---------------------------------------------------------------------------
// Brute-force throttling of FAILED logins (per IP AND per account email)
// ---------------------------------------------------------------------------

function threshold(): number {
  const value = Number(process.env.AUTH_LOGIN_MAX_FAILURES ?? 8);
  return Number.isFinite(value) && value > 0 ? value : 8;
}

function windowSeconds(): number {
  const value = Number(process.env.AUTH_LOGIN_FAILURE_WINDOW_SECONDS ?? 900); // 15 min
  return Number.isFinite(value) && value > 0 ? value : 900;
}

/** Normalized account key for per-email throttling — lowercased + trimmed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface ThrottleDecision {
  blocked: boolean;
  retryAfterSeconds: number;
}

/**
 * Decides whether this login attempt should be blocked BEFORE verifying the
 * password, based on the count of recent FAILED attempts for this IP and this
 * account email. A read-only check (does not increment) so a legitimate,
 * correct-credential attempt is never counted against the limit.
 *
 * DEGRADE-OPEN: `cacheGet` returns null when Redis is unavailable (the fixed-
 * window counters live only in Redis), so a cache outage yields count 0 =>
 * never blocked. We must NOT lock everyone out because Redis is down — this
 * matches the repo's existing degrade-open ethos (see ai-assist chat limiter).
 */
export async function checkLoginThrottle(ip: string, email: string): Promise<ThrottleDecision> {
  const limit = threshold();
  const [ipCount, emailCount] = await Promise.all([
    cacheGet<number>(authLoginFailByIp(ip)),
    cacheGet<number>(authLoginFailByEmail(normalizeEmail(email)))
  ]);
  const blocked = (ipCount ?? 0) >= limit || (emailCount ?? 0) >= limit;
  return { blocked, retryAfterSeconds: windowSeconds() };
}

/**
 * Records ONE failed login against both the IP and the account-email fixed-
 * window counters. Only FAILED attempts call this; a successful login never
 * increments, so prior failures below the threshold don't penalize a genuine
 * user once they authenticate. Never throws — degrades open on Redis outage.
 */
export async function recordLoginFailure(ip: string, email: string): Promise<void> {
  const window = windowSeconds();
  try {
    await Promise.all([
      incrementFixedWindow(authLoginFailByIp(ip), window),
      incrementFixedWindow(authLoginFailByEmail(normalizeEmail(email)), window)
    ]);
  } catch (err) {
    // incrementFixedWindow already swallows Redis errors; this is belt-and-braces.
    log.warn("failed to record login failure (non-fatal)", { reason: (err as Error).message });
  }
}
