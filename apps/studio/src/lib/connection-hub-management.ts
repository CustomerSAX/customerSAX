import "server-only";
import { getCurrentUser } from "./get-current-user";
import { connectionHubTransport, type HubConfig } from "./connection-hub-transport";
import { connectionHubCatalog } from "./connection-hub-catalog";

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
  if (path.startsWith("/v1/admin/")) {
    const key = (
      config.useConnectionHubProd
        ? process.env.CONNECTION_HUB_PROD_ADMIN_API_KEY
        : process.env.CONNECTION_HUB_ADMIN_API_KEY
    )?.trim();
    if (!key || key.length < 16 || /\s/.test(key))
      throw new HubManagementError(
        503,
        "Configure the server-side Connection Hub admin key to manage connectors."
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
      [409, 422].includes(response.status) ? response.status : 502,
      response.status === 422
        ? "Connection Hub rejected the connector credentials. Check the account, credential and resource scope."
        : "Connection Hub could not finish the connector update. Some actions may have changed. Refresh and retry."
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

async function connect(connectorId: string, input: unknown) {
  const user = await getCurrentUser();
  if (!user) throw new HubManagementError(401, "Sign in to manage connectors.");
  if (!["admin", "superadmin"].includes(user.role))
    throw new HubManagementError(403, "An administrator must connect services.");
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
      "Active project changed. Reopen the connection form."
    );
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(connectorId) ||
    connectorId.length > 100 ||
    ["algolia", "zendesk"].includes(connectorId) ||
    Object.keys(input).some(
      (key) =>
        ![
          "clientId",
          "projectKey",
          "account",
          "credential",
          "resource",
          "actions"
        ].includes(key)
    ) ||
    typeof input.account !== "string" ||
    !input.account.trim() ||
    input.account.length > 500 ||
    typeof input.credential !== "string" ||
    !input.credential ||
    input.credential.length > 12000 ||
    typeof input.resource !== "string" ||
    input.resource.length > 500 ||
    !Array.isArray(input.actions) ||
    input.actions.length < 1 ||
    input.actions.length > 100 ||
    !input.actions.every(
      (action) =>
        typeof action === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(action)
    ) ||
    new Set(input.actions).size !== input.actions.length
  )
    throw new HubManagementError(400, "Enter valid connector details and actions.");

  const connector = (await connectionHubCatalog.list()).find(
    (item) => item.id === connectorId
  );
  if (!connector)
    throw new HubManagementError(404, "This connector is no longer in the catalog.");
  const available = new Set(connector.actions.map((action) => action.id));
  if (!input.actions.every((action) => available.has(action)))
    throw new HubManagementError(400, "Select only actions offered by this connector.");

  const releases = await request(config, "/v1/admin/releases");
  if (!Array.isArray(releases.releases))
    throw new HubManagementError(502, "Unable to read approved connector releases.");
  const release = releases.releases
    .filter(
      (item: unknown): item is Record<string, unknown> =>
        record(item) &&
        item.connectorId === connectorId &&
        item.enabled === true &&
        typeof item.id === "string" &&
        !!item.id
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (!release)
    throw new HubManagementError(
      409,
      `Approve a ${connector.name} connector release in Connection Hub first.`
    );

  const projectKey = user.activeProjectKey;
  const resource = input.resource.trim() || "default";
  const connection = await request(config, "/v1/admin/connections", {
    connectorId,
    name: `CSA ${connector.name}: ${projectKey}`,
    applicationId: input.account.trim(),
    apiKey: input.credential,
    indexName: resource
  });
  if (
    typeof connection.id !== "string" ||
    !connection.id ||
    connection.connectorId !== connectorId ||
    connection.mode !== "live" ||
    connection.enabled !== true
  )
    throw new HubManagementError(502, "A live connector connection is required.");

  const previous = await bindings(config, projectKey, connectorId);
  for (const operation of input.actions) {
    const saved = previous.find(
      (item) => item.operation === operation || item.canonicalAction === operation
    );
    if (saved) {
      if (
        typeof saved.id !== "string" ||
        !saved.id ||
        !Number.isSafeInteger(saved.revision) ||
        Number(saved.revision) < 1
      )
        throw new HubManagementError(502, "Invalid project connector actions.");
      await request(config, `/v1/admin/bindings/${encodeURIComponent(saved.id)}`, {
        connectorId,
        operation,
        connectionId: connection.id,
        releaseId: release.id,
        allowedIndex: resource,
        enabled: true,
        expectedRevision: saved.revision
      });
    } else {
      await request(config, "/v1/admin/bindings", {
        connectorId,
        projectKey,
        canonicalAction: operation,
        operation,
        connectionId: connection.id,
        releaseId: release.id,
        allowedIndex: resource,
        enabled: true
      });
    }
  }
  const current = await bindings(config, projectKey, connectorId);
  if (
    input.actions.some(
      (operation) =>
        !current.some((item) => item.operation === operation && item.enabled === true)
    )
  )
    throw new HubManagementError(
      409,
      "Connector setup is incomplete. Refresh and retry the connection."
    );
  return {
    clientId: config.clientId,
    projectKey,
    connectorId,
    connected: true,
    enabledActions: input.actions.length
  };
}

export const connectionHubManagement = { connect, remove };
