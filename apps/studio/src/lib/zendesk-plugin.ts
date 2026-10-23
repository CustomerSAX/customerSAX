import "server-only";
import { getCurrentUser } from "./get-current-user";
import { connectionHubTransport, type HubConfig } from "./connection-hub-transport";

export class ZendeskPluginError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}
const action = "zendesk-find-tickets";
type Binding = {
  id: string;
  revision: number;
  tenantId: string;
  projectKey: string;
  canonicalAction: string;
  connectorId: string;
  connectionId: string;
  releaseId: string;
  enabled: boolean;
  providerAccount?: string;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function authorize(manage = false) {
  const user = await getCurrentUser();
  if (!user) throw new ZendeskPluginError(401, "Sign in to use Zendesk.");
  if (manage && !["admin", "superadmin"].includes(user.role))
    throw new ZendeskPluginError(403, "An administrator must connect Zendesk.");
  const config = connectionHubTransport.getConfig();
  if (!user.activeProjectKey || !config || user.activeClientId !== config.clientId)
    throw new ZendeskPluginError(
      403,
      "Zendesk plugins are not configured for this project."
    );
  return { config, projectKey: user.activeProjectKey };
}
type Scope = Awaited<ReturnType<typeof authorize>>;

async function request(config: HubConfig, path: string, body?: unknown, admin = false) {
  const headers = await connectionHubTransport.headers({
    config,
    json: body !== undefined,
    googleAuth: process.env.CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH === "true"
  });
  if (admin) {
    const key = (
      config.useConnectionHubProd
        ? process.env.CONNECTION_HUB_PROD_ADMIN_API_KEY
        : process.env.CONNECTION_HUB_ADMIN_API_KEY
    )?.trim();
    if (!key || key.length < 16 || /\s/.test(key))
      throw new ZendeskPluginError(
        503,
        "Configure the server-side Connection Hub admin key to connect Zendesk."
      );
    headers.authorization = `Bearer ${key}`;
  }
  const response = await fetch(`${config.url}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    if (response.status === 422)
      throw new ZendeskPluginError(
        422,
        "Zendesk validation failed. Check the subdomain, token, read permissions, and Hub live mode."
      );
    if (response.status === 409)
      throw new ZendeskPluginError(409, "The connection changed. Refresh and try again.");
    throw new ZendeskPluginError(
      502,
      "Connection Hub could not complete the request. Check its configuration and try again."
    );
  }
  const value: unknown = await response.json();
  if (!record(value))
    throw new ZendeskPluginError(502, "Invalid Connection Hub response.");
  return value;
}

async function binding(scope: Scope): Promise<Binding | undefined> {
  const payload = await request(
    scope.config,
    `/v1/projects/${encodeURIComponent(scope.projectKey)}/bindings`
  );
  if (
    !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
    !Array.isArray(payload.bindings)
  )
    throw new ZendeskPluginError(502, "Invalid project bindings.");
  const value = payload.bindings.find(
    (item: unknown) =>
      record(item) &&
      item.canonicalAction === action &&
      item.projectKey === scope.projectKey &&
      item.tenantId === scope.config.tenantId
  );
  if (value === undefined) return;
  if (
    !record(value) ||
    value.connectorId !== "zendesk" ||
    typeof value.id !== "string" ||
    typeof value.connectionId !== "string" ||
    typeof value.releaseId !== "string" ||
    !Number.isInteger(value.revision) ||
    typeof value.enabled !== "boolean"
  )
    throw new ZendeskPluginError(502, "Invalid Zendesk binding.");
  return value as Binding;
}

async function status() {
  const scope = await authorize();
  const saved = await binding(scope);
  return {
    connected: saved?.enabled === true,
    subdomain: saved?.providerAccount ?? null,
    projectKey: scope.projectKey,
    readOnly: true
  };
}

async function connect(input: unknown) {
  const scope = await authorize(true);
  if (
    !record(input) ||
    Object.keys(input).some(
      (key) => !["subdomain", "accessToken", "projectKey", "clientId"].includes(key)
    ) ||
    typeof input.subdomain !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(input.subdomain) ||
    typeof input.accessToken !== "string" ||
    !input.accessToken.trim() ||
    input.accessToken.length > 12000 ||
    /\s/.test(input.accessToken)
  )
    throw new ZendeskPluginError(
      400,
      "Enter a Zendesk subdomain and OAuth access token."
    );
  if (input.projectKey !== scope.projectKey || input.clientId !== scope.config.clientId)
    throw new ZendeskPluginError(
      409,
      "Active project changed. Reopen the Zendesk connection form."
    );
  const previous = await binding(scope);
  // Use an already approved artifact; connecting an account never approves code.
  const releases = await request(scope.config, "/v1/admin/releases", undefined, true);
  if (!Array.isArray(releases.releases))
    throw new ZendeskPluginError(502, "Invalid approved releases.");
  const release = releases.releases
    .filter(
      (item: unknown) =>
        record(item) &&
        item.connectorId === "zendesk" &&
        item.enabled === true &&
        typeof item.id === "string" &&
        typeof item.version === "string" &&
        /^(?:1\.(?:[1-9][0-9]*)\.|(?:[2-9]|[1-9][0-9]+)\.)/.test(item.version)
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (!release)
    throw new ZendeskPluginError(
      409,
      "Approve the Zendesk connector release in Connection Hub first."
    );
  const connection = await request(
    scope.config,
    "/v1/admin/connections",
    {
      connectorId: "zendesk",
      name: `CSA Assistant: ${scope.projectKey}`,
      applicationId: input.subdomain,
      apiKey: input.accessToken,
      indexName: "tickets"
    },
    true
  );
  if (
    typeof connection.id !== "string" ||
    connection.connectorId !== "zendesk" ||
    connection.mode !== "live" ||
    connection.enabled !== true
  )
    throw new ZendeskPluginError(502, "A live Zendesk connection is required.");
  const target = {
    connectorId: "zendesk",
    operation: "find-tickets",
    connectionId: connection.id,
    releaseId: release.id,
    allowedIndex: "tickets",
    enabled: true
  };
  await request(
    scope.config,
    previous
      ? `/v1/admin/bindings/${encodeURIComponent(previous.id)}`
      : "/v1/admin/bindings",
    previous
      ? { ...target, expectedRevision: previous.revision }
      : { ...target, projectKey: scope.projectKey, canonicalAction: action },
    true
  );
  return {
    connected: true,
    subdomain: input.subdomain,
    projectKey: scope.projectKey,
    readOnly: true
  };
}

async function disconnect(input: unknown) {
  const scope = await authorize(true);
  if (
    !record(input) ||
    input.projectKey !== scope.projectKey ||
    input.clientId !== scope.config.clientId
  )
    throw new ZendeskPluginError(
      409,
      "Active project changed. Reopen the Zendesk connection form."
    );
  const saved = await binding(scope);
  if (saved?.enabled)
    await request(
      scope.config,
      `/v1/admin/bindings/${encodeURIComponent(saved.id)}`,
      {
        connectorId: "zendesk",
        operation: "find-tickets",
        connectionId: saved.connectionId,
        releaseId: saved.releaseId,
        allowedIndex: "tickets",
        enabled: false,
        expectedRevision: saved.revision
      },
      true
    );
  return {
    connected: false,
    subdomain: saved?.providerAccount ?? null,
    projectKey: scope.projectKey,
    readOnly: true
  };
}
export const zendeskPlugin = { status, connect, disconnect };
