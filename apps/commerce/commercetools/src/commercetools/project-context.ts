/**
 * Per-request tenant context, carried without threading it through every
 * function signature. `index.ts` reads the `x-csa-project-key` /
 * `x-csa-client-id` headers the BFF forwards and calls `activateProjectContext`
 * for the lifetime of the request; `project-config.ts` later reads it back via
 * `currentProjectContext` to pick the right commercetools project. Falls back to
 * an empty context (-> deployment's primary project) when no headers are set.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type ProjectRequestContext = { clientId?: string; projectKey?: string };

const projectContext = new AsyncLocalStorage<ProjectRequestContext>();

/**
 * CONCURRENCY RISK — KNOWN, NOT YET FIXED (needs a dedicated change).
 *
 * This uses `enterWith`, which binds the store to the CURRENT async execution
 * context (the Apollo `context({ req })` factory that calls it) with no wrapping
 * callback. Unlike a scoped `run()`, `enterWith` does not open an isolated
 * scope — it mutates the current async resource's store — so on a reused
 * execution context it can in principle bleed one tenant's project context into
 * a concurrent request that shares an ancestor async resource.
 *
 * Why it is not converted to a scoped `run()` here: Apollo Server v4's
 * `startStandaloneServer` (used by `@csa/service-bootstrap`) owns the request
 * execution — it invokes the `context` factory, then runs the operation in a
 * continuation the subgraph never receives as a callback. There is therefore no
 * seam to wrap ALL of a request's resolver execution in `projectContext.run()`.
 * The ENTIRE platform's per-request context (including `@csa/logger`'s
 * `enterContext`) is built on this same `enterWith`-in-the-factory pattern for
 * exactly this reason, and `@csa/service-bootstrap` deliberately does not
 * restructure the Apollo server shape (see its header comment). Forcing a
 * `run()` here without that restructure would either be a no-op (it can't wrap
 * the execution) or require migrating every subgraph to `expressMiddleware` —
 * a behavioral change to the request flow, which the "correctness over forcing
 * it" rule says not to do blind.
 *
 * DEDICATED FIX (tracked): migrate the subgraph to `expressMiddleware` and wrap
 * each request in `runWithContext`/`projectContext.run(...)`, OR stop using a
 * module-level ALS and read the project context off the Apollo `contextValue`
 * (per-request isolated by construction) instead — either wrapped resolver
 * execution or explicit threading. Both are larger, separately-verified changes.
 */
export function activateProjectContext(context: ProjectRequestContext) {
  projectContext.enterWith(context);
}

export function currentProjectContext() {
  return projectContext.getStore() ?? {};
}
