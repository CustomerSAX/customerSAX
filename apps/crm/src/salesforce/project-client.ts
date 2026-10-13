import { createHash } from "node:crypto";
import {
  issueSalesforceServiceToken,
  projectSalesforceCredentials,
  type ProjectCrm,
  type SalesforceCredentials
} from "@csa/mongodb";
import { salesforceRequest } from "./client.js";

export type SalesforceApi = <T>(path: string, method?: string, body?: unknown) => Promise<T | null>;
export type SalesforceProjectClient = { instanceUrl: () => Promise<string>; api: SalesforceApi };

// Salesforce client-credentials tokens carry no expiry; the org session timeout
// applies. Re-issue well before typical timeouts and immediately on HTTP 401.
const TOKEN_TTL_MS = 20 * 60_000;
const tokens = new Map<
  string,
  { token?: string; instanceUrl?: string; expiresAt: number; pending?: Promise<{ token: string; instanceUrl: string }> }
>();

export function salesforceClient(cacheKey: string, credentials: SalesforceCredentials): SalesforceProjectClient {
  const key = createHash("sha256").update(cacheKey).digest("hex");
  async function session() {
    let entry = tokens.get(key);
    if (entry?.token && entry.instanceUrl && entry.expiresAt > Date.now())
      return { token: entry.token, instanceUrl: entry.instanceUrl };
    if (entry?.pending) return entry.pending;
    // Bound memory; evicted entries simply obtain a new token.
    if (tokens.size >= 500) tokens.delete(tokens.keys().next().value!);
    entry = { expiresAt: 0 };
    tokens.set(key, entry);
    const current = entry;
    current.pending = issueSalesforceServiceToken(credentials)
      .then(({ accessToken, instanceUrl }) => {
        current.token = accessToken;
        current.instanceUrl = instanceUrl;
        current.expiresAt = Date.now() + TOKEN_TTL_MS;
        return { token: accessToken, instanceUrl };
      })
      .finally(() => {
        current.pending = undefined;
      });
    return current.pending;
  }
  return {
    instanceUrl: async () => (await session()).instanceUrl,
    api: async <T>(path: string, method = "GET", body?: unknown) => {
      for (let attempt = 0; ; attempt++) {
        const { token, instanceUrl } = await session();
        try {
          return await salesforceRequest<T>(instanceUrl, token, path, { method, body });
        } catch (error) {
          const unauthenticated =
            (error as { extensions?: { code?: string } }).extensions?.code === "UNAUTHENTICATED";
          if (!unauthenticated) throw error;
          tokens.delete(key);
          if (attempt === 0) continue;
          throw new Error("Salesforce authorization failed. Check this project's CRM connection in Superadmin");
        }
      }
    }
  };
}

export function projectSalesforceClient(clientId: string, projectKey: string, settings: ProjectCrm) {
  return salesforceClient(JSON.stringify([clientId, projectKey, settings]), projectSalesforceCredentials(settings));
}
