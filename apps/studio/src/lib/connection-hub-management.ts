import "server-only";
import { getCurrentUser } from "./get-current-user";
import { connectionHubTransport, type HubConfig } from "./connection-hub-transport";

export class HubManagementError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function request(config: HubConfig, path: string, body?: unknown) {
  const headers = await connectionHubTransport.headers({
    config,
    json: body !== undefined,
    googleAuth: process.env.CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH === "true"
  });
  if (body !== undefined) {
    const key = (
      config.useConnectionHubProd
        ? process.env.CONNECTION_HUB_PROD_ADMIN_API_KEY
        : process.env.CONNECTION_HUB_ADMIN_API_KEY
    )?.trim();
    if (!key || key.length < 16 || /\s/.test(key))
      throw new HubManagementError(
        503,
        "Configure the server-side Connection Hub admin key to remove connectors."
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
  if (!response.ok)
    throw new HubManagementError(
      response.status === 409 ? 409 : 502,
      "Connection Hub could not finish removal. Some actions may have changed. Refresh and retry."
    );
  const payload: unknown = await response.json();
  if (!record(payload))
    throw new HubManagementError(502, "Invalid Connection Hub response.");
  return payload;
}

async function bindings(config: HubConfig, projectKey: string, connectorId: string) {
  const payload = await request(
    config,
    `/v1/projects/${encodeURIComponent(projectKey)}/bindings`
  );
  if (
    !Array.isArray(payload.bindings) ||
    !["customersax", "connection-hub"].includes(String(payload.applicationId))
  )
    throw new HubManagementError(502, "Unable to read project connector actions.");
  const saved = payload.bindings.filter(
    (item: unknown): item is Record<string, unknown> =>
      record(item) &&
      item.tenantId === config.tenantId &&
      item.projectKey === projectKey &&
      item.connectorId === connectorId
  );
  if (!saved.every((item) => typeof item.enabled === "boolean"))
    throw new HubManagementError(502, "Invalid project connector actions.");
  return saved;
}

async function remove(connectorId: string, input: unknown) {
  const user = await getCurrentUser();
  if (!user) throw new HubManagementError(401, "Sign in to manage connectors.");
  if (!["admin", "superadmin"].includes(user.role))
    throw new HubManagementError(403, "An administrator must remove connectors.");
  const config = connectionHubTransport.getConfig();
  if (!config || !user.activeProjectKey || user.activeClientId !== config.clientId)
    throw new HubManagementError(
      403,
      "Connection Hub is not configured for this project."
    );
  if (
    !record(input) ||
    input.clientId !== config.clientId ||
    input.projectKey !== user.activeProjectKey
  )
    throw new HubManagementError(
      409,
      "Active project changed. Reopen the removal dialog."
    );
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(connectorId) ||
    connectorId.length > 100 ||
    Object.keys(input).some((key) => !["clientId", "projectKey"].includes(key))
  )
    throw new HubManagementError(400, "Invalid connector removal request.");
  const projectKey = user.activeProjectKey;
  const saved = await bindings(config, projectKey, connectorId);
  const enabled = saved.filter((item) => item.enabled);
  // Validate all targets before writing; clients never choose a binding or account.
  if (
    !enabled.every(
      (item) =>
        ["id", "operation", "connectionId", "releaseId", "allowedIndex"].every(
          (key) => typeof item[key] === "string" && item[key] !== ""
        ) &&
        Number.isSafeInteger(item.revision) &&
        Number(item.revision) > 0
    ) ||
    new Set(enabled.map((item) => item.id)).size !== enabled.length
  )
    throw new HubManagementError(502, "Invalid project connector actions.");
  for (const target of enabled) {
    await request(config, `/v1/admin/bindings/${encodeURIComponent(String(target.id))}`, {
      connectorId,
      operation: target.operation,
      connectionId: target.connectionId,
      releaseId: target.releaseId,
      allowedIndex: target.allowedIndex,
      enabled: false,
      expectedRevision: target.revision
    });
  }
  if ((await bindings(config, projectKey, connectorId)).some((item) => item.enabled))
    throw new HubManagementError(
      409,
      "This connector still has enabled actions. Refresh and retry removal."
    );
  return { clientId: config.clientId, projectKey, connectorId, connected: false };
}

export const connectionHubManagement = { remove };
