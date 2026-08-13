import { AsyncLocalStorage } from "node:async_hooks";

export type ProjectRequestContext = { clientId?: string; projectKey?: string };

const projectContext = new AsyncLocalStorage<ProjectRequestContext>();

export function activateProjectContext(context: ProjectRequestContext) {
  projectContext.enterWith(context);
}

export function currentProjectContext() {
  return projectContext.getStore() ?? {};
}
