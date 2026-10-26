import "server-only";
import { algoliaHub, AlgoliaHubError, type AlgoliaBinding } from "@csa/connection-hub";
import { getCurrentUser } from "./get-current-user";

export class AlgoliaPluginError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorize(manage = false) {
  const user = await getCurrentUser();
  if (!user) throw new AlgoliaPluginError(401, "Sign in to use Algolia.");
  if (manage && !["admin", "superadmin"].includes(user.role))
    throw new AlgoliaPluginError(403, "An administrator must connect Algolia.");
  if (!user.activeClientId || !user.activeProjectKey)
    throw new AlgoliaPluginError(409, "Select a project first.");
  const config = algoliaHub.configuration(user.activeClientId);
  if (!config)
    throw new AlgoliaPluginError(
      503,
      "Connection Hub is not configured for this project."
    );
  return { config, projectKey: user.activeProjectKey };
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
    throw new AlgoliaPluginError(
      409,
      "Active project changed. Reopen the Algolia connection form."
    );
}

function view(scope: Scope, saved: AlgoliaBinding[]) {
  const selected = saved.some((item) => item.enabled);
  return {
    connected: algoliaHub.complete(saved),
    selected,
    incomplete: selected && !algoliaHub.complete(saved),
    indexName:
      saved.find((item) => item.enabled)?.allowedIndex ?? saved[0]?.allowedIndex ?? null,
    clientId: scope.config.clientId,
    projectKey: scope.projectKey,
    readOnly: true
  };
}

async function status() {
  const scope = await authorize();
  return view(scope, await algoliaHub.bindings(scope));
}

async function connect(input: unknown) {
  const scope = await authorize(true);
  checkScope(input, scope);
  if (
    Object.keys(input).some(
      (key) =>
        !["clientId", "projectKey", "applicationId", "apiKey", "indexName"].includes(key)
    ) ||
    typeof input.applicationId !== "string" ||
    !/^[A-Za-z0-9]{1,63}$/.test(input.applicationId) ||
    typeof input.indexName !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(input.indexName) ||
    typeof input.apiKey !== "string" ||
    !input.apiKey ||
    input.apiKey.length > 12000 ||
    /\s/.test(input.apiKey)
  )
    throw new AlgoliaPluginError(
      400,
      "Enter a valid Algolia application ID, index name and read-only API key."
    );
  const previous = await algoliaHub.bindings(scope);
  const releases = await algoliaHub.request({
    config: scope.config,
    path: "/v1/admin/releases",
    admin: true
  });
  if (!Array.isArray(releases.releases))
    throw new AlgoliaPluginError(502, "Unable to read approved releases.");
  const candidates = releases.releases.filter(
    (item: unknown): item is Record<string, unknown> =>
      record(item) &&
      item.connectorId === "algolia" &&
      item.enabled === true &&
      typeof item.id === "string" &&
      typeof item.version === "string"
  );
  const release = candidates.sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  )[0];
  if (!release || typeof release.id !== "string")
    throw new AlgoliaPluginError(
      409,
      "Approve an Algolia connector release in Connection Hub first."
    );
  const connection = await algoliaHub.request({
    config: scope.config,
    path: "/v1/admin/connections",
    admin: true,
    body: {
      connectorId: "algolia",
      name: `CSA Algolia: ${scope.projectKey}`,
      applicationId: input.applicationId,
      apiKey: input.apiKey,
      indexName: input.indexName
    }
  });
  if (
    typeof connection.id !== "string" ||
    connection.connectorId !== "algolia" ||
    connection.mode !== "live" ||
    connection.enabled !== true
  )
    throw new AlgoliaPluginError(502, "A live Algolia connection is required.");
  for (const canonicalAction of ["search-products", "browse-records"]) {
    const saved = previous.find((item) => item.canonicalAction === canonicalAction);
    await algoliaHub.request({
      config: scope.config,
      path: saved
        ? `/v1/admin/bindings/${encodeURIComponent(saved.id)}`
        : "/v1/admin/bindings",
      admin: true,
      body: {
        connectorId: "algolia",
        operation:
          canonicalAction === "search-products" ? "rc_search_products" : "browse-records",
        connectionId: connection.id,
        releaseId: release.id,
        allowedIndex: input.indexName,
        enabled: true,
        ...(saved
          ? { expectedRevision: saved.revision }
          : { projectKey: scope.projectKey, canonicalAction })
      }
    });
  }
  const current = await algoliaHub.bindings(scope);
  if (!algoliaHub.complete(current))
    throw new AlgoliaPluginError(
      409,
      "Algolia setup is incomplete. Refresh and reconnect it."
    );
  return view(scope, current);
}

async function disconnect(input: unknown) {
  const scope = await authorize(true);
  checkScope(input, scope);
  if (Object.keys(input).some((key) => !["clientId", "projectKey"].includes(key)))
    throw new AlgoliaPluginError(400, "Invalid removal request.");
  const saved = await algoliaHub.bindings(scope);
  for (const target of saved.filter((item) => item.enabled)) {
    await algoliaHub.request({
      config: scope.config,
      path: `/v1/admin/bindings/${encodeURIComponent(target.id)}`,
      admin: true,
      body: {
        connectorId: "algolia",
        operation: target.operation,
        connectionId: target.connectionId,
        releaseId: target.releaseId,
        allowedIndex: target.allowedIndex,
        enabled: false,
        expectedRevision: target.revision
      }
    });
  }
  const current = await algoliaHub.bindings(scope);
  if (current.some((item) => item.enabled))
    throw new AlgoliaPluginError(
      409,
      "Algolia is still selected. Refresh and retry removal."
    );
  return view(scope, current);
}

function message(error: unknown) {
  if (error instanceof AlgoliaPluginError) return error;
  if (error instanceof AlgoliaHubError) {
    const text =
      error.code === "HUB_ADMIN_KEY_REQUIRED"
        ? "Configure the server-side Hub admin key to manage Algolia."
        : error.status === 422
          ? "Algolia validation failed. Check the application ID, index, read key, search/browse permissions, and Hub live mode."
          : error.status === 409
            ? "The connection changed or is incomplete. Refresh and retry."
            : "Connection Hub could not update Algolia. Refresh the connection status and try again.";
    return new AlgoliaPluginError(error.status, text);
  }
  return new AlgoliaPluginError(
    502,
    "Algolia is temporarily unavailable. Refresh the connection status and try again."
  );
}

export const algoliaPlugin = { status, connect, disconnect, message };
type Scope = Awaited<ReturnType<typeof authorize>>;
