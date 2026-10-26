import { GoogleAuth, type IdTokenClient } from "google-auth-library";

export class AlgoliaHubError extends Error {
  constructor(
    readonly status: number,
    readonly code = "ALGOLIA_HUB_UNAVAILABLE"
  ) {
    super("Algolia is unavailable through Connection Hub");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configuration(clientId: string): HubConfig | undefined {
  if (
    process.env.CONNECTION_HUB_ENABLED !== "true" ||
    process.env.CONNECTION_HUB_CLIENT_ID?.trim() !== clientId
  )
    return undefined;
  const prod = process.env.USE_CONNECTION_HUB_PROD ?? "false";
  const privateHub = process.env.CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH ?? "false";
  if (!["true", "false"].includes(prod) || !["true", "false"].includes(privateHub))
    throw new AlgoliaHubError(503);
  const raw =
    prod === "true"
      ? process.env.CONNECTION_HUB_PROD_URL
      : process.env.CONNECTION_HUB_URL;
  const key = (
    prod === "true"
      ? process.env.CONNECTION_HUB_PROD_API_KEY
      : process.env.CONNECTION_HUB_API_KEY
  )?.trim();
  if (!raw || !key || key.length < 16 || /\s/.test(key)) throw new AlgoliaHubError(503);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AlgoliaHubError(503);
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        prod === "false" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new AlgoliaHubError(503);
  const tenantId =
    (prod === "true"
      ? process.env.CONNECTION_HUB_PROD_TENANT_ID
      : process.env.CONNECTION_HUB_TENANT_ID
    )?.trim() || clientId;
  return {
    url: url.origin,
    apiKey: key,
    tenantId,
    clientId,
    production: prod === "true",
    privateHub: privateHub === "true"
  };
}

async function request({
  config,
  path,
  body,
  admin = false
}: {
  config: HubConfig;
  path: string;
  body?: unknown;
  admin?: boolean;
}): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    "x-tenant-id": config.tenantId
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (admin) {
    const key = (
      config.production
        ? process.env.CONNECTION_HUB_PROD_ADMIN_API_KEY
        : process.env.CONNECTION_HUB_ADMIN_API_KEY
    )?.trim();
    if (!key || key.length < 16 || /\s/.test(key))
      throw new AlgoliaHubError(503, "HUB_ADMIN_KEY_REQUIRED");
    headers.authorization = `Bearer ${key}`;
  }
  if (config.privateHub) {
    let pending = clients.get(config.url);
    if (!pending) {
      pending = auth.getIdTokenClient(config.url);
      clients.set(config.url, pending);
      pending.catch(() => clients.delete(config.url));
    }
    const value = (await (await pending).getRequestHeaders()).get("authorization");
    if (!value?.startsWith("Bearer ")) throw new AlgoliaHubError(503);
    headers["X-Serverless-Authorization"] = value;
  }
  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(30000)
    });
  } catch {
    throw new AlgoliaHubError(502);
  }
  if (!response.ok)
    throw new AlgoliaHubError(
      [403, 409, 422, 503].includes(response.status) ? response.status : 502
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new AlgoliaHubError(502);
  }
  if (!record(value)) throw new AlgoliaHubError(502);
  return value;
}

async function bindings({
  config,
  projectKey
}: {
  config: HubConfig;
  projectKey: string;
}): Promise<AlgoliaBinding[]> {
  if (!projectKey) throw new AlgoliaHubError(409);
  const payload = await request({
    config,
    path: `/v1/projects/${encodeURIComponent(projectKey)}/bindings`
  });
  if (
    !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
    !Array.isArray(payload.bindings)
  )
    throw new AlgoliaHubError(502);
  const result = payload.bindings
    .filter(
      (item: unknown) =>
        record(item) &&
        item.tenantId === config.tenantId &&
        item.projectKey === projectKey &&
        ["search-products", "browse-records"].includes(String(item.canonicalAction))
    )
    .map((item: unknown): AlgoliaBinding => {
      if (
        !record(item) ||
        item.connectorId !== "algolia" ||
        typeof item.id !== "string" ||
        typeof item.connectionId !== "string" ||
        typeof item.releaseId !== "string" ||
        typeof item.allowedIndex !== "string" ||
        !item.allowedIndex ||
        typeof item.enabled !== "boolean" ||
        typeof item.revision !== "number" ||
        !Number.isSafeInteger(item.revision) ||
        (item.canonicalAction !== "search-products" &&
          item.canonicalAction !== "browse-records") ||
        item.operation !==
          (item.canonicalAction === "search-products"
            ? "rc_search_products"
            : "browse-records")
      )
        throw new AlgoliaHubError(502);
      return {
        id: item.id,
        connectionId: item.connectionId,
        releaseId: item.releaseId,
        allowedIndex: item.allowedIndex,
        revision: item.revision,
        enabled: item.enabled,
        canonicalAction: item.canonicalAction,
        operation:
          item.canonicalAction === "search-products"
            ? "rc_search_products"
            : "browse-records"
      };
    });
  if (new Set(result.map((item) => item.canonicalAction)).size !== result.length)
    throw new AlgoliaHubError(502);
  return result;
}

function complete(values: AlgoliaBinding[]) {
  return (
    values.length === 2 &&
    values.every((item) => item.enabled) &&
    values.every(
      (item) =>
        item.connectionId === values[0].connectionId &&
        item.releaseId === values[0].releaseId &&
        item.allowedIndex === values[0].allowedIndex
    )
  );
}

async function forProject({
  clientId,
  projectKey
}: {
  clientId: string;
  projectKey: string;
}): Promise<AlgoliaScope | undefined> {
  const config = configuration(clientId);
  if (!config) return;
  const saved = await bindings({ config, projectKey });
  if (!saved.some((item) => item.enabled)) return;
  if (!complete(saved)) throw new AlgoliaHubError(409, "ALGOLIA_CONNECTION_INCOMPLETE");
  return { config, projectKey, bindings: saved };
}

async function search({
  scope,
  query,
  limit
}: {
  scope: AlgoliaScope;
  query: string;
  limit: number;
}): Promise<HubProducts> {
  if (
    typeof query !== "string" ||
    query.trim().length > 300 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new AlgoliaHubError(400);
  const text = query.trim();
  const canonical = text ? "search-products" : "browse-records";
  const binding = scope.bindings.find(
    (item) => item.canonicalAction === canonical && item.enabled
  );
  if (!binding) throw new AlgoliaHubError(409);
  const payload = await request({
    config: scope.config,
    path: `/v1/projects/${encodeURIComponent(scope.projectKey)}/actions/${canonical}`,
    body: text ? { query: text, limit } : { limit }
  });
  const execution = payload.execution;
  if (
    !record(execution) ||
    execution.mode !== "live" ||
    execution.tenantId !== scope.config.tenantId ||
    execution.projectKey !== scope.projectKey ||
    execution.connector !== "@rc-connect/algolia" ||
    execution.action !== binding.operation ||
    execution.bindingId !== binding.id ||
    execution.connectionId !== binding.connectionId ||
    execution.bindingRevision !== binding.revision ||
    execution.releaseId !== binding.releaseId
  )
    throw new AlgoliaHubError(502);
  const results: unknown =
    text && record(payload.data) ? payload.data.hits : payload.data;
  const total = text && record(payload.data) ? payload.data.nbHits : null;
  if (
    !Array.isArray(results) ||
    !results.every(record) ||
    results.length > limit ||
    (text &&
      (typeof total !== "number" ||
        !Number.isSafeInteger(total) ||
        total < results.length))
  )
    throw new AlgoliaHubError(502);
  return { results, total: typeof total === "number" ? total : null };
}

const auth = new GoogleAuth();
const clients = new Map<string, Promise<IdTokenClient>>();
export const algoliaHub = {
  configuration,
  request,
  bindings,
  complete,
  forProject,
  search
};
export type HubConfig = {
  url: string;
  apiKey: string;
  tenantId: string;
  clientId: string;
  production: boolean;
  privateHub: boolean;
};
export type AlgoliaBinding = {
  id: string;
  connectionId: string;
  releaseId: string;
  allowedIndex: string;
  revision: number;
  enabled: boolean;
  canonicalAction: "search-products" | "browse-records";
  operation: string;
};
export type AlgoliaScope = {
  config: HubConfig;
  projectKey: string;
  bindings: AlgoliaBinding[];
};
export type HubProducts = { results: Record<string, unknown>[]; total: number | null };
