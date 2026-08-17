/**
 * `@csa/logger` — the shared structured-logging layer for CSA backend services.
 *
 * Public surface:
 *   - `createLogger(service)` → a `Logger` facade (JSON in prod, colorized in
 *     dev) whose lines auto-carry the active request context;
 *   - request-context helpers (`runWithContext`, `getContext`, `newRequestId`,
 *     `runAsSystem`, …) backed by a native `AsyncLocalStorage`;
 *   - edge helpers (`withHttpContext`, `expressContext`, `apolloContext`,
 *     `apolloLoggingPlugin`) that seed the context and emit access logs;
 *   - PII-safety helpers (`describe`, `safeMeta`).
 *
 * The browser/client shim with the same `Logger` shape (no Winston) lives at
 * `@csa/logger/client`.
 */
import { getContext } from "./context.js";
import { setContextProvider } from "./logger.js";

// Wire the logger's auto-merge to the request context. `userEmail` is
// intentionally excluded here so it never lands in a log line (PII-safe).
setContextProvider(() => {
  const ctx = getContext();
  if (!ctx) return undefined;
  const { userEmail: _userEmail, ...safe } = ctx;
  return safe;
});

export { createLogger, safeStringify, normalizeTrace } from "./logger.js";
export type { Logger, LogMeta } from "./logger.js";
export {
  runWithContext,
  enterContext,
  getContext,
  getRequestId,
  newRequestId,
  runAsSystem,
  type RequestContext,
} from "./context.js";
export {
  withHttpContext,
  expressContext,
  apolloContext,
  apolloLoggingPlugin,
  REQUEST_ID_HEADER,
} from "./http.js";
export { describe, safeMeta } from "./redact.js";
