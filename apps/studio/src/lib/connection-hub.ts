import "server-only";
import { currentSessionToken, getValidatedSession } from "../app/api/auth/shared";
import { connectionHubTransport, type HubConfig } from "./connection-hub-transport";

export class ConnectionHubError extends Error {
  constructor(
    readonly status: number,
    readonly code = "HUB_REQUEST_FAILED"
  ) {
    super("Product search is unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfig() {
  try {
    return connectionHubTransport.getConfig();
  } catch {
    throw new ConnectionHubError(503, "HUB_CONFIGURATION_REQUIRED");
  }
}

async function headers(options: Parameters<typeof connectionHubTransport.headers>[0]) {
  try {
    return await connectionHubTransport.headers(options);
  } catch {
    throw new ConnectionHubError(503, "HUB_GOOGLE_AUTH_REQUIRED");
  }
}

async function forProject({
  clientId,
  projectKey
}: {
  clientId: string;
  projectKey: string;
}): Promise<HubProjectConfig | undefined> {
  const config = getConfig();
  if (!config || config.clientId !== clientId) return undefined;
  if (!projectKey) throw new ConnectionHubError(409);
  const response = await fetch(
    `${config.url}/v1/projects/${encodeURIComponent(projectKey)}/bindings`,
    {
      headers: await headers({ config }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000)
    }
  );
  if (!response.ok) throw new ConnectionHubError(response.status === 403 ? 403 : 502);
  const payload: unknown = await response.json();
  if (
    !record(payload) ||
    !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
    !Array.isArray(payload.bindings)
  )
    throw new ConnectionHubError(502);
  const relevant = payload.bindings.filter(
    (binding: unknown) =>
      record(binding) &&
      binding.tenantId === config.tenantId &&
      binding.projectKey === projectKey &&
      ["search-products", "browse-records"].includes(String(binding.canonicalAction))
  );
  if (relevant.length === 0) {
    if (config.useConnectionHubProd)
      throw new ConnectionHubError(409, "HUB_PROJECT_NOT_BOUND");
    return undefined;
  }
  return { ...config, projectKey };
}

async function authorize(): Promise<HubProjectConfig> {
  const token = await currentSessionToken();
  if (!token) throw new ConnectionHubError(401);
  const payload: unknown = await getValidatedSession(token);
  if (!record(payload) || !record(payload.user)) throw new ConnectionHubError(401);
  const { activeClientId, activeProjectKey } = payload.user;
  if (typeof activeClientId !== "string" || typeof activeProjectKey !== "string")
    throw new ConnectionHubError(409);
  const config = await forProject({
    clientId: activeClientId,
    projectKey: activeProjectKey
  });
  if (!config) throw new ConnectionHubError(403);
  return config;
}

async function search({
  query,
  limit,
  requestId,
  config
}: {
  query: string;
  limit: number;
  requestId: string;
  config: HubProjectConfig;
}): Promise<HubProducts> {
  const action = query ? "search-products" : "browse-records";
  const response = await fetch(
    `${config.url}/v1/projects/${encodeURIComponent(config.projectKey)}/actions/${action}`,
    {
      method: "POST",
      headers: await headers({ config, requestId, json: true }),
      body: JSON.stringify(query ? { query, limit } : { limit }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
      redirect: "error"
    }
  );
  if (!response.ok)
    throw new ConnectionHubError(
      [403, 404, 409, 503].includes(response.status) ? response.status : 502
    );
  const payload: unknown = await response.json();
  if (
    !record(payload) ||
    !record(payload.execution) ||
    payload.execution.mode !== "live" ||
    payload.execution.projectKey !== config.projectKey ||
    payload.execution.tenantId !== config.tenantId
  )
    throw new ConnectionHubError(502);
  const results: unknown =
    query && record(payload.data) ? payload.data.hits : payload.data;
  if (!Array.isArray(results) || !results.every(record) || results.length > limit)
    throw new ConnectionHubError(502);
  const total = query && record(payload.data) ? payload.data.nbHits : null;
  if (
    query &&
    (typeof total !== "number" || !Number.isSafeInteger(total) || total < results.length)
  )
    throw new ConnectionHubError(502);
  return { results, total: typeof total === "number" ? total : null };
}

function parseInput(value: unknown) {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !["query", "limit"].includes(key))
  )
    throw new ConnectionHubError(400);
  const query = value.query === undefined ? "" : value.query;
  const limit = value.limit === undefined ? 20 : value.limit;
  if (
    typeof query !== "string" ||
    query.trim().length > 300 ||
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new ConnectionHubError(400);
  return { query: query.trim(), limit };
}

export const connectionHub = {
  getConfig,
  headers,
  forProject,
  authorize,
  search,
  parseInput
};
export type HubProducts = { results: Record<string, unknown>[]; total: number | null };
type HubProjectConfig = HubConfig & { projectKey: string };
