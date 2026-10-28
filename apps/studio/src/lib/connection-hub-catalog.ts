import "server-only";
import { GoogleAuth, type IdTokenClient } from "google-auth-library";

export class HubCatalogError extends Error {
  constructor(readonly status: number) {
    super("Connection Hub catalog is unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configuration() {
  if (process.env.CONNECTION_HUB_ENABLED !== "true") throw new HubCatalogError(503);
  const production = process.env.USE_CONNECTION_HUB_PROD ?? "false";
  const privateHub = process.env.CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH ?? "false";
  if (!["true", "false"].includes(production) || !["true", "false"].includes(privateHub))
    throw new HubCatalogError(503);
  const rawUrl =
    production === "true"
      ? process.env.CONNECTION_HUB_PROD_URL
      : process.env.CONNECTION_HUB_URL;
  const apiKey = (
    production === "true"
      ? process.env.CONNECTION_HUB_PROD_API_KEY
      : process.env.CONNECTION_HUB_API_KEY
  )?.trim();
  if (!rawUrl || !apiKey || apiKey.length < 16 || /\s/.test(apiKey))
    throw new HubCatalogError(503);
  const url = new URL(rawUrl.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        production === "false" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new HubCatalogError(503);
  return { origin: url.origin, apiKey, privateHub: privateHub === "true" };
}

function connector(value: unknown): HubCatalogConnector {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    typeof value.category !== "string" ||
    !record(value.authentication) ||
    typeof value.authentication.type !== "string" ||
    !Array.isArray(value.actions)
  )
    throw new HubCatalogError(502);
  const actions = value.actions.map((action: unknown) => {
    if (
      !record(action) ||
      typeof action.id !== "string" ||
      !action.id ||
      typeof action.name !== "string" ||
      typeof action.readOnly !== "boolean"
    )
      throw new HubCatalogError(502);
    return { id: action.id, name: action.name, readOnly: action.readOnly };
  });
  if (new Set(actions.map((action) => action.id)).size !== actions.length)
    throw new HubCatalogError(502);
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    category: value.category,
    authenticationType: value.authentication.type,
    actions
  };
}

async function list(): Promise<HubCatalogConnector[]> {
  try {
    const config = configuration();
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    };
    if (config.privateHub) {
      let pending = clients.get(config.origin);
      if (!pending) {
        pending = auth.getIdTokenClient(config.origin);
        clients.set(config.origin, pending);
        pending.catch(() => clients.delete(config.origin));
      }
      const identity = (await (await pending).getRequestHeaders()).get("authorization");
      if (!identity?.startsWith("Bearer ")) throw new HubCatalogError(503);
      headers["X-Serverless-Authorization"] = identity;
    }
    const connectors: HubCatalogConnector[] = [];
    const ids = new Set<string>();
    const cursors = new Set<string>();
    const signal = AbortSignal.timeout(20000);
    let after: string | null = null;
    for (;;) {
      const response = await fetch(`${config.origin}/graphql`, {
        method: "POST",
        headers,
        redirect: "error",
        cache: "no-store",
        signal,
        body: JSON.stringify({ query: QUERY, variables: { first: 50, after } })
      });
      if (!response.ok) throw new HubCatalogError(502);
      const payload: unknown = await response.json();
      if (
        !record(payload) ||
        payload.errors !== undefined ||
        !record(payload.data) ||
        !record(payload.data.connectors)
      )
        throw new HubCatalogError(502);
      const page = payload.data.connectors;
      if (
        !Array.isArray(page.nodes) ||
        !record(page.pageInfo) ||
        typeof page.pageInfo.hasNextPage !== "boolean"
      )
        throw new HubCatalogError(502);
      for (const node of page.nodes) {
        const item = connector(node);
        if (ids.has(item.id)) throw new HubCatalogError(502);
        ids.add(item.id);
        connectors.push(item);
      }
      if (!page.pageInfo.hasNextPage) return connectors;
      const cursor = page.pageInfo.endCursor;
      if (
        !page.nodes.length ||
        typeof cursor !== "string" ||
        !cursor ||
        cursors.has(cursor)
      )
        throw new HubCatalogError(502);
      cursors.add(cursor);
      after = cursor;
    }
  } catch (error) {
    if (error instanceof HubCatalogError) throw error;
    throw new HubCatalogError(502);
  }
}

const QUERY = `query CustomerSaxConnectorCatalog($first: Int!, $after: ID) {
  connectors(first: $first, after: $after) {
    nodes { id name description category authentication { type } actions { id name readOnly } }
    pageInfo { endCursor hasNextPage }
  }
}`;
const auth = new GoogleAuth();
const clients = new Map<string, Promise<IdTokenClient>>();

export const connectionHubCatalog = { list };
export type HubCatalogConnector = {
  id: string;
  name: string;
  description: string;
  category: string;
  authenticationType: string;
  actions: { id: string; name: string; readOnly: boolean }[];
};
