/**
 * Per-request structured logger for the studio app's server-side API routes.
 *
 * Each route seeds a child logger from the inbound `x-request-id` (generating
 * one if absent) so a correlation id set by the browser — or propagated on to
 * ai-assist / the BFF via `forwardRequestId` — ties the whole request chain
 * together in the logs.
 *
 * This uses the dependency-free `@csa/logger/client` shim (console-backed, same
 * `Logger` shape) rather than the Winston-backed server logger, so nothing is
 * bundled into the Next.js output that its webpack build can't handle — the
 * shim still emits one structured line per call, carrying `service: "studio"`
 * plus the `module`/`requestId` bindings.
 */
import { CSA_HEADERS } from "@csa/headers";
import { createLogger, type Logger } from "@csa/logger/client";

/** Header used to carry the correlation id across every service hop. */
export const REQUEST_ID_HEADER = CSA_HEADERS.requestId;

const base = createLogger("studio");

export interface RequestLogger {
  log: Logger;
  requestId: string;
}

/** Seeds a `{ module, requestId }`-bound logger for one API route invocation. */
export function requestLogger(request: Request, module: string): RequestLogger {
  const requestId = request.headers.get(REQUEST_ID_HEADER)?.trim() || crypto.randomUUID();
  return { log: base.child({ module, requestId }), requestId };
}

/**
 * Returns a `Headers` (usable as fetch `init.headers`) carrying the correlation
 * id, for outbound fetches to ai-assist / the BFF so the id survives the hop.
 */
export function forwardRequestId(requestId: string, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set(REQUEST_ID_HEADER, requestId);
  return headers;
}
