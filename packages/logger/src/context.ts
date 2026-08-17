/**
 * Per-request context carried implicitly through async call chains via a native
 * `AsyncLocalStorage`. Every service seeds this once at its edge (an HTTP
 * request handler / Apollo `context` factory), and the `Logger` returned by
 * `createLogger` auto-merges the active context into every log line — so a
 * `requestId` (and the tenant/user identity that came in on the request) is
 * attached to logs written deep inside business logic without threading it
 * through every function signature.
 *
 * PII note: `userEmail` is deliberately part of the context shape (some call
 * sites legitimately need to resolve "who am I") but is NOT auto-logged by the
 * logger — see `logger.ts`.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  /** Correlation id — generated at the edge or taken from an inbound `x-request-id`. */
  requestId: string;
  projectKey?: string;
  clientId?: string;
  userRole?: string;
  /** Present for identity resolution; never auto-logged (PII). */
  userEmail?: string;
  method?: string;
  path?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` with `context` active for the entire async chain it starts. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Binds `context` to the *current* async execution without a wrapping callback.
 * Useful where the framework owns the callback (e.g. an Apollo `context`
 * factory that returns before the operation executes).
 */
export function enterContext(context: RequestContext): void {
  storage.enterWith(context);
}

/** The active request context, or `undefined` outside any request. */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** The active correlation id, or `undefined` outside any request. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** A fresh correlation id (UUID v4). */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Runs `fn` inside a synthetic context for background/system work that has no
 * inbound request (cron-like startup tasks, index creation, seed jobs). The
 * `actor` labels the system principal so its logs are still correlatable.
 */
export function runAsSystem<T>(actor: string, fn: () => T): T {
  return storage.run({ requestId: newRequestId(), userRole: `system:${actor}` }, fn);
}
