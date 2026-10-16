import "server-only";
import { applyCsaHeaders } from "@csa/headers";
import { authServiceUrl, currentSessionToken } from "../app/api/auth/shared";

export class ConnectionHubError extends Error {
  constructor(readonly status: number) {
    super("Product search is unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfig(): HubConfig | undefined {
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

function forProject({
  clientId,
  projectKey,
  settings
}: {
  clientId: string;
  projectKey: string;
  settings: ProjectProductsSettings | null;
}): HubProjectConfig | undefined {
  const config = getConfig();
  if (
    !config ||
    config.clientId !== clientId ||
    !projectKey ||
    settings?.provider !== "algolia"
  )
    return undefined;
  if (!settings.appId || !settings.indexName) throw new ConnectionHubError(503);
  return {
    ...config,
    projectKey,
    applicationId: settings.appId,
    indexName: settings.indexName
  };
}

async function authorize(): Promise<HubProjectConfig> {
  const token = await currentSessionToken();
  if (!token) throw new ConnectionHubError(401);
  const response = await fetch(`${authServiceUrl()}/sessions/current`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok)
    throw new ConnectionHubError(
      response.status === 401 || response.status === 403 ? 401 : 502
    );
  const payload: unknown = await response.json();
  if (!record(payload) || !record(payload.user)) throw new ConnectionHubError(401);
  const { activeClientId, activeProjectKey } = payload.user;
  if (typeof activeClientId !== "string" || typeof activeProjectKey !== "string")
    throw new ConnectionHubError(409);
  const deployment = getConfig();
  if (!deployment || deployment.clientId !== activeClientId)
    throw new ConnectionHubError(403);
  const settingsResponse = await fetch(
    process.env.BFF_URL?.trim() ||
      process.env.AI_COMMERCE_SERVICE_URL?.trim() ||
      "http://127.0.0.1:4000/graphql",
    {
      method: "POST",
      headers: applyCsaHeaders(new Headers({ "content-type": "application/json" }), {
        clientId: activeClientId,
        projectKey: activeProjectKey,
        userEmail:
          typeof payload.user.email === "string" ? payload.user.email : undefined,
        userRole: typeof payload.user.role === "string" ? payload.user.role : undefined
      }),
      body: JSON.stringify({
        query:
          "query SelectedProjectSearch { projectProductsConfiguration { provider appId indexName } }"
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000)
    }
  );
  if (!settingsResponse.ok) throw new ConnectionHubError(502);
  const settingsPayload: unknown = await settingsResponse.json();
  if (
    !record(settingsPayload) ||
    (Array.isArray(settingsPayload.errors) && settingsPayload.errors.length > 0) ||
    !record(settingsPayload.data)
  )
    throw new ConnectionHubError(502);
  const settings = settingsPayload.data.projectProductsConfiguration;
  if (settings === undefined) throw new ConnectionHubError(502);
  if (!record(settings) || typeof settings.provider !== "string")
    throw new ConnectionHubError(403);
  const config = forProject({
    clientId: activeClientId,
    projectKey: activeProjectKey,
    settings: {
      provider: settings.provider,
      appId: typeof settings.appId === "string" ? settings.appId : undefined,
      indexName: typeof settings.indexName === "string" ? settings.indexName : undefined
    }
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
  const response = await fetch(`${config.url}/v1/actions/${action}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
      "x-request-id": requestId,
      "x-csa-client-id": config.clientId,
      "x-csa-project-key": config.projectKey
    },
    body: JSON.stringify({
      ...(query ? { query, limit } : { limit }),
      binding: { applicationId: config.applicationId, indexName: config.indexName }
    }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
    redirect: "error"
  });
  if (!response.ok)
    throw new ConnectionHubError(
      response.status === 403 ? 403 : response.status === 503 ? 503 : 502
    );
  const payload: unknown = await response.json();
  if (!record(payload) || !record(payload.execution) || payload.execution.mode !== "live")
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
type HubConfig = { url: string; apiKey: string; clientId: string };
type HubProjectConfig = HubConfig & {
  projectKey: string;
  applicationId: string;
  indexName: string;
};
type ProjectProductsSettings = { provider: string; appId?: string; indexName?: string };
