/**
 * PII-safety helpers. The rule across CSA logging is: log *shapes and
 * identifiers*, never raw user content. `describe` renders any value as a
 * type+size fingerprint (never the value itself), and `safeMeta` filters a meta
 * object down to an allowlist of keys that are safe to persist in logs.
 */

/** A non-revealing fingerprint of a value: its type and a size, never its contents. */
export function describe(v: unknown): { type: string; size?: number } {
  if (v === null) return { type: "null" };
  if (v === undefined) return { type: "undefined" };
  if (typeof v === "string") return { type: "string", size: v.length };
  if (typeof v === "number") return { type: "number" };
  if (typeof v === "boolean") return { type: "boolean" };
  if (typeof v === "bigint") return { type: "bigint" };
  if (typeof v === "function") return { type: "function" };
  if (Array.isArray(v)) return { type: "array", size: v.length };
  if (v instanceof Date) return { type: "date" };
  if (v instanceof Error) return { type: "error" };
  if (Buffer.isBuffer(v)) return { type: "buffer", size: v.length };
  if (typeof v === "object") return { type: "object", size: Object.keys(v as object).length };
  return { type: typeof v };
}

/**
 * Keys that are always safe to log verbatim — stable identifiers, roles,
 * counts, durations, and statuses. Anything not on the allowlist (and not
 * matching the id/count/duration/status suffix heuristics in `isSafeKey`) is
 * dropped by `safeMeta`.
 */
const SAFE_META_KEYS = new Set<string>([
  "projectKey",
  "clientId",
  "userRole",
  "requestId",
  "service",
  "module",
  "method",
  "path",
  "operationName",
  "provider",
  "platform",
  "status",
  "statusCode",
  "count",
  "duration",
  "durationMs",
  "ms",
]);

/** Keys that must NEVER be logged, even if a heuristic would otherwise allow them. */
const DENY_META_KEYS = new Set<string>([
  "email",
  "userEmail",
  "to",
  "recipient",
  "password",
  "secret",
  "token",
  "accessToken",
  "authorization",
  "auth",
  "address",
  "body",
  "html",
  "message",
  "content",
  "plaintext",
  "ciphertext",
]);

function isSafeKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (DENY_META_KEYS.has(key) || DENY_META_KEYS.has(lower)) return false;
  if (SAFE_META_KEYS.has(key)) return true;
  // Identifier / metric suffixes are safe by convention.
  if (/(^|[a-z])id$|ids$|count$|counts$|duration$|durationms$|status$|statuscode$|ms$/.test(lower)) return true;
  return false;
}

/**
 * Reduces an arbitrary meta object to its log-safe subset. Allowlisted keys and
 * id/count/duration/status-shaped keys pass through; everything else is
 * dropped. Never mutates the input.
 */
export function safeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (isSafeKey(key)) out[key] = value;
  }
  return out;
}
