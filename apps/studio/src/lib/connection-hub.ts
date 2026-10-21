import "server-only";
import { currentSessionToken, getValidatedSession } from "../app/api/auth/shared";

export class ConnectionHubError extends Error {
  constructor(readonly status: number) {
    super("Product search is unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfig() {
  if (process.env.CONNECTION_HUB_ENABLED !== "true") return undefined;
  const url = process.env.CONNECTION_HUB_URL?.trim();
  const apiKey = process.env.CONNECTION_HUB_API_KEY?.trim();
  const clientId = process.env.CONNECTION_HUB_CLIENT_ID?.trim();
  if (!url || !apiKey || apiKey.length < 16 || !clientId)
    throw new ConnectionHubError(503);
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    (parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(parsed.hostname)
      ))
  )
    throw new ConnectionHubError(503);
  return { url: parsed.origin, apiKey, clientId };
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
      headers: { authorization: `Bearer ${config.apiKey}`, "x-tenant-id": clientId },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000)
    }
  );
  if (!response.ok) throw new ConnectionHubError(response.status === 403 ? 403 : 502);
  const payload: unknown = await response.json();
  if (
    !record(payload) ||
    payload.applicationId !== "customersax" ||
    !Array.isArray(payload.bindings)
  )
    throw new ConnectionHubError(502);
  const relevant = payload.bindings.filter(
    (binding: unknown) =>
      record(binding) &&
      binding.tenantId === clientId &&
      binding.projectKey === projectKey &&
      ["search-products", "browse-records"].includes(String(binding.canonicalAction))
  );
  if (relevant.length === 0) return undefined;
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
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-tenant-id": config.clientId
      },
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
    payload.execution.tenantId !== config.clientId
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

export const connectionHub = { getConfig, forProject, authorize, search, parseInput };
export type HubProducts = { results: Record<string, unknown>[]; total: number | null };
type HubProjectConfig = {
  url: string;
  apiKey: string;
  clientId: string;
  projectKey: string;
};
