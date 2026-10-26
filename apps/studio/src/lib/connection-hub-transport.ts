import "server-only";
import { GoogleAuth, type IdTokenClient } from "google-auth-library";

function getConfig(): HubConfig | undefined {
  if (process.env.CONNECTION_HUB_ENABLED !== "true") return undefined;
  const flag = process.env.USE_CONNECTION_HUB_PROD ?? "false";
  if (flag !== "true" && flag !== "false") throw new Error("HUB_MODE_INVALID");
  const useConnectionHubProd = flag === "true";
  const url = (
    useConnectionHubProd
      ? process.env.CONNECTION_HUB_PROD_URL
      : process.env.CONNECTION_HUB_URL
  )?.trim();
  const apiKey = (
    useConnectionHubProd
      ? process.env.CONNECTION_HUB_PROD_API_KEY
      : process.env.CONNECTION_HUB_API_KEY
  )?.trim();
  const clientId = process.env.CONNECTION_HUB_CLIENT_ID?.trim();
  if (!url || !apiKey || apiKey.length < 16 || /\s/.test(apiKey) || !clientId)
    throw new Error("HUB_CONFIGURATION_REQUIRED");
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    (parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        !useConnectionHubProd &&
        ["127.0.0.1", "localhost"].includes(parsed.hostname)
      ))
  )
    throw new Error("HUB_URL_INVALID");
  const tenantId =
    (useConnectionHubProd
      ? process.env.CONNECTION_HUB_PROD_TENANT_ID
      : process.env.CONNECTION_HUB_TENANT_ID
    )?.trim() || clientId;
  return { url: parsed.origin, apiKey, clientId, tenantId, useConnectionHubProd };
}

async function headers({
  config,
  requestId,
  json = false,
  googleAuth = true
}: {
  config: HubConfig;
  requestId?: string;
  json?: boolean;
  googleAuth?: boolean;
}): Promise<Record<string, string>> {
  const result: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    "x-tenant-id": config.tenantId
  };
  if (requestId) result["x-request-id"] = requestId;
  if (json) result["content-type"] = "application/json";
  if (config.useConnectionHubProd && googleAuth) {
    let pending = clients.get(config.url);
    if (!pending) {
      pending = auth.getIdTokenClient(config.url);
      clients.set(config.url, pending);
      pending.catch(() => {
        clients.delete(config.url);
      });
    }
    const client = await pending;
    const identityHeaders = await client.getRequestHeaders();
    const identity = identityHeaders.get("authorization");
    if (!identity?.startsWith("Bearer ")) throw new Error("HUB_GOOGLE_ID_TOKEN_REQUIRED");
    result["X-Serverless-Authorization"] = identity;
  }
  return result;
}

const auth = new GoogleAuth();
const clients = new Map<string, Promise<IdTokenClient>>();

export const connectionHubTransport = { getConfig, headers };
export type HubConfig = {
  url: string;
  apiKey: string;
  clientId: string;
  tenantId: string;
  useConnectionHubProd: boolean;
};
