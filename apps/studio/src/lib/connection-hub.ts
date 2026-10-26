import "server-only";
import { currentSessionToken, getValidatedSession } from "../app/api/auth/shared";
import { algoliaHub, AlgoliaHubError, type AlgoliaScope } from "@csa/connection-hub";
import { connectionHubTransport } from "./connection-hub-transport";

export class ConnectionHubError extends Error {
  constructor(
    readonly status: number,
    readonly code = "HUB_REQUEST_FAILED"
  ) {
    super("Product search is unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfig() {
  try {
    return connectionHubTransport.getConfig();
  } catch {
    throw new ConnectionHubError(503, "HUB_CONFIGURATION_REQUIRED");
  }
}

async function headers(options: Parameters<typeof connectionHubTransport.headers>[0]) {
  try {
    return await connectionHubTransport.headers(options);
  } catch {
    throw new ConnectionHubError(503, "HUB_GOOGLE_AUTH_REQUIRED");
  }
}

async function forProject(identity: {
  clientId: string;
  projectKey: string;
}): Promise<AlgoliaScope | undefined> {
  try {
    return await algoliaHub.forProject(identity);
  } catch (error) {
    throw new ConnectionHubError(
      error instanceof AlgoliaHubError ? error.status : 502,
      error instanceof AlgoliaHubError ? error.code : "HUB_REQUEST_FAILED"
    );
  }
}

async function authorize(): Promise<AlgoliaScope> {
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
  config
}: {
  query: string;
  limit: number;
  config: AlgoliaScope;
  requestId: string;
}): Promise<HubProducts> {
  try {
    return await algoliaHub.search({ scope: config, query, limit });
  } catch (error) {
    throw new ConnectionHubError(error instanceof AlgoliaHubError ? error.status : 502);
  }
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

export const connectionHub = {
  getConfig,
  headers,
  forProject,
  authorize,
  search,
  parseInput
};
export type HubProducts = { results: Record<string, unknown>[]; total: number | null };
