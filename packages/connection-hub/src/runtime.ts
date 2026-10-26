import { GoogleAuth } from "google-auth-library";

export class HubRuntimeError extends Error {
  constructor(
    message: string,
    readonly status = 503
  ) {
    super(message);
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export type PlatformConfig = {
  url: string;
  apiKey: string;
  tenantId: string;
  clientId: string;
  production: boolean;
  privateHub: boolean;
};
export type HubBinding = {
  id: string;
  tenantId: string;
  projectKey: string;
  connectorId: string;
  canonicalAction: string;
  operation: string;
  connectionId: string;
  releaseId: string;
  revision: number;
  allowedIndex: string;
  enabled: boolean;
  providerAccount?: string;
};
export type HubProject = {
  config: PlatformConfig;
  projectKey: string;
  bindings: HubBinding[];
};

/** Platform authentication is provisioned once, independently of provider credentials. */
export function platformConfiguration(clientId: string): PlatformConfig | undefined {
  const raw = process.env.CONNECTION_HUB_PLATFORM_CONFIG?.trim();
  if (raw) {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new HubRuntimeError("Invalid Connection Hub platform configuration");
    }
    if (
      !record(value) ||
      !record(value.tenants) ||
      typeof value.url !== "string" ||
      typeof value.apiKey !== "string"
    )
      throw new HubRuntimeError("Invalid Connection Hub platform configuration");
    const tenantId = value.tenants[clientId];
    if (typeof tenantId !== "string" || !tenantId)
      throw new HubRuntimeError("This client is not registered with Connection Hub", 403);
    return validate({
      url: value.url,
      apiKey: value.apiKey,
      tenantId,
      clientId,
      production: process.env.NODE_ENV === "production",
      privateHub: value.privateHub === true
    });
  }
  if (process.env.CONNECTION_HUB_ENABLED !== "true") {
    if (process.env.NODE_ENV === "production")
      throw new HubRuntimeError(
        "Connection Hub platform authentication has not been provisioned"
      );
    return undefined;
  }
  if (process.env.CONNECTION_HUB_CLIENT_ID?.trim() !== clientId)
    throw new HubRuntimeError("This client is not registered with Connection Hub", 403);
  const prod = process.env.USE_CONNECTION_HUB_PROD ?? "false";
  const privateHub = process.env.CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH ?? "false";
  if (!["true", "false"].includes(prod) || !["true", "false"].includes(privateHub))
    throw new HubRuntimeError("Invalid Connection Hub platform configuration");
  return validate({
    url:
      (prod === "true"
        ? process.env.CONNECTION_HUB_PROD_URL
        : process.env.CONNECTION_HUB_URL) ?? "",
    apiKey:
      (prod === "true"
        ? process.env.CONNECTION_HUB_PROD_API_KEY
        : process.env.CONNECTION_HUB_API_KEY
      )?.trim() ?? "",
    tenantId:
      (prod === "true"
        ? process.env.CONNECTION_HUB_PROD_TENANT_ID
        : process.env.CONNECTION_HUB_TENANT_ID
      )?.trim() || clientId,
    clientId,
    production: prod === "true",
    privateHub: privateHub === "true"
  });
}
function validate(config: PlatformConfig) {
  let url: URL;
  try {
    url = new URL(config.url);
  } catch {
    throw new HubRuntimeError("Invalid Connection Hub platform URL");
  }
  if (
    !config.apiKey ||
    config.apiKey.length < 16 ||
    /\s/.test(config.apiKey) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        !config.production &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new HubRuntimeError("Invalid Connection Hub platform configuration");
  return { ...config, url: url.origin };
}
const auth = new GoogleAuth();
async function request(config: PlatformConfig, path: string, body?: unknown) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    "x-tenant-id": config.tenantId
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (config.privateHub) {
    const token = (
      await (await auth.getIdTokenClient(config.url)).getRequestHeaders()
    ).get("authorization");
    if (!token)
      throw new HubRuntimeError("Connection Hub platform authentication failed");
    headers["X-Serverless-Authorization"] = token;
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
    throw new HubRuntimeError("Connection Hub is unavailable", 502);
  }
  if (!response.ok)
    throw new HubRuntimeError(
      "Connection Hub rejected the project action. Check its enabled connection and permissions.",
      response.status
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new HubRuntimeError("Invalid Connection Hub response", 502);
  }
  if (!record(value)) throw new HubRuntimeError("Invalid Connection Hub response", 502);
  return value;
}
async function project(
  clientId: string,
  projectKey: string
): Promise<HubProject | undefined> {
  if (!clientId || !projectKey)
    throw new HubRuntimeError("An authenticated client and project are required", 403);
  const config = platformConfiguration(clientId);
  if (!config) return undefined;
  const payload = await request(
    config,
    `/v1/projects/${encodeURIComponent(projectKey)}/bindings`
  );
  if (
    !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
    !Array.isArray(payload.bindings)
  )
    throw new HubRuntimeError("Invalid Connection Hub project", 502);
  const bindings = payload.bindings.filter(
    (item: unknown) =>
      record(item) && item.tenantId === config.tenantId && item.projectKey === projectKey
  );
  if (
    !bindings.every(
      (item: Record<string, unknown>) =>
        [
          "id",
          "connectorId",
          "canonicalAction",
          "operation",
          "connectionId",
          "releaseId",
          "allowedIndex"
        ].every((key) => typeof item[key] === "string" && item[key]) &&
        Number.isSafeInteger(item.revision) &&
        Number(item.revision) > 0 &&
        typeof item.enabled === "boolean"
    )
  )
    throw new HubRuntimeError("Invalid Connection Hub bindings", 502);
  if (
    new Set(bindings.map((item: HubBinding) => item.canonicalAction)).size !==
    bindings.length
  )
    throw new HubRuntimeError("Duplicate Connection Hub actions", 502);
  return { config, projectKey, bindings: bindings as HubBinding[] };
}
async function execute(scope: HubProject, binding: HubBinding, body: unknown) {
  if (!binding.enabled || !scope.bindings.includes(binding))
    throw new HubRuntimeError("Enable this action in Connection Hub first", 409);
  const payload = await request(
    scope.config,
    `/v1/projects/${encodeURIComponent(scope.projectKey)}/actions/${encodeURIComponent(binding.canonicalAction)}`,
    body
  );
  const execution = payload.execution;
  if (
    !record(execution) ||
    execution.mode !== "live" ||
    execution.tenantId !== scope.config.tenantId ||
    execution.projectKey !== scope.projectKey ||
    execution.connector !== `@rc-connect/${binding.connectorId}` ||
    execution.bindingId !== binding.id ||
    execution.connectionId !== binding.connectionId ||
    execution.bindingRevision !== binding.revision ||
    execution.releaseId !== binding.releaseId ||
    execution.action !== binding.operation ||
    typeof execution.providerStatus !== "number"
  )
    throw new HubRuntimeError(
      "Connection Hub execution did not match the selected project action",
      502
    );
  return { data: payload.data, status: execution.providerStatus };
}
async function api<T>(
  scope: HubProject,
  binding: HubBinding,
  path: string,
  method = "GET",
  body?: unknown
): Promise<T | null> {
  if (
    !path ||
    path.startsWith("//") ||
    /^[a-z]+:/i.test(path) ||
    path
      .split("?")[0]
      .split("/")
      .some((part) => part === ".." || part === ".") ||
    path.includes("#")
  )
    throw new HubRuntimeError("Invalid connector API path", 400);
  const result = await execute(scope, binding, {
    url: { url: path },
    method,
    body_type: body === undefined ? "none" : "json",
    ...(body === undefined ? {} : { body: { data: body } }),
    failsafe: false,
    followRedirects: false,
    response_is_binary: false
  });
  if (result.status === 404) return null;
  if (result.status < 200 || result.status >= 300)
    throw new HubRuntimeError(
      `Connector request failed (HTTP ${result.status}). Check its Connection Hub credentials and permissions.`,
      result.status
    );
  // Activepieces custom API actions return an HTTP envelope inside Hub's data.
  const data = result.data;
  if (
    !record(data) ||
    typeof data.status !== "number" ||
    data.status !== result.status ||
    !("body" in data)
  )
    throw new HubRuntimeError("Invalid connector API response", 502);
  return data.body as T;
}
export const hubRuntime = { project, execute, api };
