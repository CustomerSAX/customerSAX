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

export function activateProjectContext(context: ProjectRequestContext) {
  projectContext.enterWith(context);
}

export function currentProjectContext() {
  return projectContext.getStore() ?? {};
}
