import "server-only";
import { connectionHub } from "./connection-hub";
import { currentSessionToken, getValidatedSession } from "../app/api/auth/shared";

export class TeamsHubError extends Error {
  constructor(readonly status: number) {
    super("Microsoft Teams is unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInput(value: unknown): TeamsInput {
  if (!record(value)) throw new TeamsHubError(400);
  if (value.operation === "team" || value.operation === "channels") {
    if (Object.keys(value).some((key) => key !== "operation"))
      throw new TeamsHubError(400);
    return { operation: value.operation };
  }
  const channelId = value.channelId;
  if (
    typeof channelId !== "string" ||
    !/^[a-zA-Z0-9:@_-][a-zA-Z0-9:@_.-]{0,255}$/.test(channelId)
  )
    throw new TeamsHubError(400);
  if (value.operation === "messages") {
    const limit = value.limit ?? 20;
    if (
      Object.keys(value).some(
        (key) => !["operation", "channelId", "limit"].includes(key)
      ) ||
      typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      throw new TeamsHubError(400);
    return { operation: "messages", channelId, limit };
  }
  if (
    value.operation === "message" &&
    typeof value.messageId === "string" &&
    /^[0-9]{1,30}$/.test(value.messageId) &&
    Object.keys(value).every((key) =>
      ["operation", "channelId", "messageId"].includes(key)
    )
  )
    return { operation: "message", channelId, messageId: value.messageId };
  throw new TeamsHubError(400);
}

async function authorize() {
  const token = await currentSessionToken();
  if (!token) throw new TeamsHubError(401);
  const session: unknown = await getValidatedSession(token);
  if (!record(session) || !record(session.user)) throw new TeamsHubError(401);
  const { activeClientId, activeProjectKey } = session.user;
  if (
    typeof activeClientId !== "string" ||
    typeof activeProjectKey !== "string" ||
    !activeProjectKey
  )
    throw new TeamsHubError(409);
  const config = connectionHub.getConfig();
  if (!config || config.clientId !== activeClientId) throw new TeamsHubError(403);
  const response = await fetch(
    `${config.url}/v1/projects/${encodeURIComponent(activeProjectKey)}/bindings`,
    {
      headers: await connectionHub.headers({ config }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000)
    }
  );
  if (!response.ok) throw new TeamsHubError(502);
  const payload: unknown = await response.json();
  if (
    !record(payload) ||
    !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
    !Array.isArray(payload.bindings)
  )
    throw new TeamsHubError(502);
  const binding: unknown = payload.bindings.find(
    (item: unknown) =>
      record(item) &&
      item.tenantId === config.tenantId &&
      item.projectKey === activeProjectKey &&
      item.canonicalAction === "teams-read"
  );
  if (
    !record(binding) ||
    binding.connectorId !== "microsoft-teams" ||
    binding.enabled !== true ||
    typeof binding.id !== "string" ||
    typeof binding.connectionId !== "string"
  )
    throw new TeamsHubError(403);
  return {
    ...config,
    projectKey: activeProjectKey,
    bindingId: binding.id,
    connectionId: binding.connectionId
  };
}

async function execute({
  input,
  config,
  requestId
}: {
  input: TeamsInput;
  config: Awaited<ReturnType<typeof authorize>>;
  requestId: string;
}) {
  const response = await fetch(
    `${config.url}/v1/projects/${encodeURIComponent(config.projectKey)}/actions/teams-read`,
    {
      method: "POST",
      headers: await connectionHub.headers({ config, requestId, json: true }),
      body: JSON.stringify(input),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000)
    }
  );
  if (!response.ok)
    throw new TeamsHubError(
      [403, 404, 409, 503].includes(response.status) ? response.status : 502
    );
  const payload: unknown = await response.json();
  if (!record(payload) || !record(payload.execution) || !record(payload.data))
    throw new TeamsHubError(502);
  const execution = payload.execution;
  if (
    execution.mode !== "live" ||
    execution.connector !== "@rc-connect/microsoft-teams" ||
    execution.tenantId !== config.tenantId ||
    execution.projectKey !== config.projectKey ||
    execution.bindingId !== config.bindingId ||
    execution.connectionId !== config.connectionId
  )
    throw new TeamsHubError(502);
  if (execution.providerStatus !== 200)
    throw new TeamsHubError(execution.providerStatus === 404 ? 404 : 502);
  if (input.operation === "channels" || input.operation === "messages") {
    if (!Array.isArray(payload.data.value) || !payload.data.value.every(record))
      throw new TeamsHubError(502);
  } else if (typeof payload.data.id !== "string") throw new TeamsHubError(502);
  return { data: payload.data, execution };
}

export const connectionHubTeams = { authorize, execute, parseInput };
type TeamsInput =
  | { operation: "team" | "channels" }
  | { operation: "messages"; channelId: string; limit: number }
  | { operation: "message"; channelId: string; messageId: string };
