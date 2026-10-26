import "server-only";
import { zendeskHub, ZendeskPluginError } from "./zendesk-plugin";

type Scope = Awaited<ReturnType<typeof zendeskHub.authorize>>;
type Binding = {
  id: string;
  revision: number;
  canonicalAction: string;
  operation: string;
  connectionId: string;
  releaseId: string;
  allowedIndex: string;
  providerAccount: string;
  enabled: boolean;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function bindings(scope: Scope): Promise<Binding[]> {
  const payload = await zendeskHub.request(
    scope.config,
    `/v1/projects/${encodeURIComponent(scope.projectKey)}/bindings`
  );
  if (
    !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
    !Array.isArray(payload.bindings)
  )
    throw new ZendeskPluginError(502, "Unable to read Zendesk project actions.");
  const saved = payload.bindings.filter(
    (item: unknown) =>
      record(item) &&
      item.tenantId === scope.config.tenantId &&
      item.projectKey === scope.projectKey &&
      item.connectorId === "zendesk"
  );
  if (
    !saved.every(
      (item: Record<string, unknown>) =>
        [
          "id",
          "canonicalAction",
          "operation",
          "connectionId",
          "releaseId",
          "allowedIndex",
          "providerAccount"
        ].every((key) => typeof item[key] === "string" && item[key] !== "") &&
        Number.isSafeInteger(item.revision) &&
        Number(item.revision) > 0 &&
        typeof item.enabled === "boolean"
    ) ||
    new Set(saved.map((item: Binding) => item.canonicalAction)).size !== saved.length
  )
    throw new ZendeskPluginError(502, "Invalid Zendesk project actions.");
  return saved as Binding[];
}

function view(scope: Scope, saved: Binding[]) {
  const enabled = saved.filter((item) => item.enabled);
  return {
    clientId: scope.config.clientId,
    projectKey: scope.projectKey,
    connected: enabled.length > 0,
    subdomain: saved[0]?.providerAccount ?? null,
    enabledActions: enabled.length,
    incomplete: enabled.some((item) => item.connectionId !== enabled[0].connectionId)
  };
}

function checkScope(
  input: unknown,
  scope: Scope
): asserts input is Record<string, unknown> {
  if (
    !record(input) ||
    input.clientId !== scope.config.clientId ||
    input.projectKey !== scope.projectKey
  )
    throw new ZendeskPluginError(
      409,
      "Active project changed. Reopen the Zendesk connection form."
    );
}

async function status() {
  const scope = await zendeskHub.authorize(true);
  return view(scope, await bindings(scope));
}

async function update(
  scope: Scope,
  target: Binding,
  connectionId: string,
  enabled: boolean
) {
  await zendeskHub.request(
    scope.config,
    `/v1/admin/bindings/${encodeURIComponent(target.id)}`,
    {
      connectorId: "zendesk",
      operation: target.operation,
      connectionId,
      releaseId: target.releaseId,
      allowedIndex: target.allowedIndex,
      enabled,
      expectedRevision: target.revision
    },
    true
  );
}

const reads = [
  { canonicalAction: "zendesk-read", operation: "rc_zendesk_read" },
  { canonicalAction: "zendesk-find-tickets", operation: "find-tickets" }
];

async function connect(input: unknown) {
  const scope = await zendeskHub.authorize(true);
  checkScope(input, scope);
  if (
    Object.keys(input).some(
      (key) => !["clientId", "projectKey", "subdomain", "accessToken"].includes(key)
    ) ||
    typeof input.subdomain !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(input.subdomain) ||
    typeof input.accessToken !== "string" ||
    !input.accessToken ||
    input.accessToken.length > 12000 ||
    /\s/.test(input.accessToken)
  )
    throw new ZendeskPluginError(
      400,
      "Enter a Zendesk subdomain and OAuth access token."
    );
  const previous = await bindings(scope);
  if (previous.some((item) => item.providerAccount !== input.subdomain))
    throw new ZendeskPluginError(
      409,
      "Update credentials for the same Zendesk account. Manage account changes in Connection Hub."
    );

  // Rotation keeps each existing action's reviewed release and enabled state.
  // New/reconnected projects enable only the two read actions.
  const selected = previous.some((item) => item.enabled);
  const missing = reads.filter(
    (read) => !previous.some((item) => item.canonicalAction === read.canonicalAction)
  );
  let releaseId: string | undefined;
  if (!selected && missing.length) {
    const payload = await zendeskHub.request(
      scope.config,
      "/v1/admin/releases",
      undefined,
      true
    );
    if (!Array.isArray(payload.releases))
      throw new ZendeskPluginError(502, "Unable to read approved releases.");
    const release = payload.releases
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
    if (!release || typeof release.id !== "string")
      throw new ZendeskPluginError(
        409,
        "Approve the Zendesk connector release in Connection Hub first."
      );
    releaseId = release.id;
  }
  const connection = await zendeskHub.request(
    scope.config,
    "/v1/admin/connections",
    {
      connectorId: "zendesk",
      name: `CSA Zendesk: ${scope.projectKey}`,
      applicationId: input.subdomain,
      apiKey: input.accessToken,
      indexName: "tickets"
    },
    true
  );
  if (
    typeof connection.id !== "string" ||
    !connection.id ||
    connection.connectorId !== "zendesk" ||
    connection.mode !== "live" ||
    connection.enabled !== true
  )
    throw new ZendeskPluginError(502, "A live Zendesk connection is required.");
  for (const target of previous) {
    await update(
      scope,
      target,
      connection.id,
      selected
        ? target.enabled
        : reads.some((read) => read.canonicalAction === target.canonicalAction)
    );
  }
  if (!selected) {
    for (const read of missing) {
      await zendeskHub.request(
        scope.config,
        "/v1/admin/bindings",
        {
          ...read,
          connectorId: "zendesk",
          projectKey: scope.projectKey,
          connectionId: connection.id,
          releaseId,
          allowedIndex: "tickets",
          enabled: true
        },
        true
      );
    }
  }
  const current = await bindings(scope);
  if (
    !current.length ||
    current.some((item) => item.connectionId !== connection.id) ||
    previous.some(
      (target) =>
        !current.some(
          (item) =>
            item.id === target.id &&
            item.enabled ===
              (selected
                ? target.enabled
                : reads.some((read) => read.canonicalAction === target.canonicalAction))
        )
    ) ||
    (!selected &&
      reads.some(
        (read) =>
          !current.some(
            (item) => item.canonicalAction === read.canonicalAction && item.enabled
          )
      ))
  )
    throw new ZendeskPluginError(
      409,
      "Zendesk setup changed or is incomplete. Refresh its status and retry the credential update."
    );
  return view(scope, current);
}

async function disconnect(input: unknown) {
  const scope = await zendeskHub.authorize(true);
  checkScope(input, scope);
  if (Object.keys(input).some((key) => !["clientId", "projectKey"].includes(key)))
    throw new ZendeskPluginError(400, "Invalid removal request.");
  for (const target of (await bindings(scope)).filter((item) => item.enabled))
    await update(scope, target, target.connectionId, false);
  const current = await bindings(scope);
  if (current.some((item) => item.enabled))
    throw new ZendeskPluginError(
      409,
      "Zendesk still has enabled actions. Refresh its status and retry removal."
    );
  return view(scope, current);
}

export const zendeskConnector = { status, connect, disconnect };
