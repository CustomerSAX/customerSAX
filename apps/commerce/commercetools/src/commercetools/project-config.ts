/**
 * Resolves which commercetools project (tenant) the current request runs
 * against, and the credentials to reach it. The subgraph is multi-tenant: the
 * BFF forwards `x-csa-project-key` / `x-csa-client-id` per request (see
 * `project-context.ts`), and this module turns that into a concrete
 * `CommercetoolsProjectConfig`.
 *
 * Resolution precedence (first match wins) in `resolveCommercetoolsProject`:
 *   1. No selected project, or it equals COMMERCETOOLS_PROJECT_KEY -> the
 *      deployment's primary project from env (`environmentProject`). This is
 *      also the recovery path when a stored record was encrypted with a key
 *      that isn't available locally.
 *   2. A stored Superadmin record for (clientId, projectKey), with its secret
 *      decrypted on read (see `project-store.ts`).
 *   3. A statically configured project in COMMERCETOOLS_PROJECTS_JSON.
 *   4. Otherwise: throw — never fall back to a fabricated/placeholder tenant.
 *
 * `normalizeProject` is the single choke point that trims URLs and asserts
 * every required credential is present, so a half-configured tenant fails loudly
 * at resolution time rather than mid-query.
 */
import { currentProjectContext } from "./project-context.js";
import { findStoredCommercetoolsProject } from "./project-store.js";

export type CommercetoolsProjectConfig = {
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  projectKey: string;
  scope?: string;
};

type ProjectConfigInput = Partial<Omit<CommercetoolsProjectConfig, "projectKey">>;

export async function resolveCommercetoolsProject(): Promise<CommercetoolsProjectConfig> {
  const selectedProjectKey = currentProjectContext().projectKey;
  const selectedClientId = currentProjectContext().clientId;
  const environmentProjectKey = process.env.COMMERCETOOLS_PROJECT_KEY?.trim();

  // Preserve the deployment's primary project configuration. This is also
  // the recovery path when older Superadmin records were encrypted with a
  // key that is no longer available locally.
  if (!selectedProjectKey || selectedProjectKey === environmentProjectKey) {
    return environmentProject();
  }

  if (selectedClientId) {
    const stored = await findStoredCommercetoolsProject(selectedClientId, selectedProjectKey);
    if (stored) return normalizeProject(selectedProjectKey, stored);
  }

  if (selectedProjectKey !== environmentProjectKey) {
    const configuredProjects = parseConfiguredProjects();
    const selected = configuredProjects[selectedProjectKey];
    if (!selected) {
      throw new Error(`Selected project '${selectedProjectKey}' is not configured in Superadmin or COMMERCETOOLS_PROJECTS_JSON`);
    }
    return normalizeProject(selectedProjectKey, selected);
  }

  return environmentProject();
}

function environmentProject() {
  const projectKey = required(process.env.COMMERCETOOLS_PROJECT_KEY?.trim(), "COMMERCETOOLS_PROJECT_KEY");
  const graphqlUrl = process.env.COMMERCETOOLS_GRAPHQL_URL?.trim();
  const apiUrl = process.env.COMMERCETOOLS_API_URL?.trim()
    || (graphqlUrl ? graphqlUrl.replace(new RegExp(`/${escapeRegExp(projectKey)}/graphql/?$`), "") : undefined);

  return normalizeProject(projectKey, {
    apiUrl,
    authUrl: process.env.COMMERCETOOLS_AUTH_URL,
    clientId: process.env.COMMERCETOOLS_CLIENT_ID ?? process.env.CT_CLIENT_ID,
    clientSecret: process.env.COMMERCETOOLS_CLIENT_SECRET ?? process.env.CT_CLIENT_SECRET,
    scope: process.env.COMMERCETOOLS_SCOPE
  });
}

function parseConfiguredProjects(): Record<string, ProjectConfigInput> {
  const raw = process.env.COMMERCETOOLS_PROJECTS_JSON?.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, ProjectConfigInput>;
  } catch {
    throw new Error("COMMERCETOOLS_PROJECTS_JSON must be valid JSON");
  }
}

function normalizeProject(projectKey: string, value: ProjectConfigInput): CommercetoolsProjectConfig {
  return {
    projectKey,
    apiUrl: trimUrl(required(value.apiUrl, `${projectKey}.apiUrl`)),
    authUrl: trimUrl(required(value.authUrl, `${projectKey}.authUrl`)),
    clientId: required(value.clientId, `${projectKey}.clientId`),
    clientSecret: required(value.clientSecret, `${projectKey}.clientSecret`),
    scope: value.scope?.trim() || undefined
  };
}

function required(value: string | undefined, label: string) {
  if (!value?.trim()) throw new Error(`Missing ${label}`);
  return value.trim();
}

function trimUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
