import { createHash } from "node:crypto";
import {
  ZOHO_REGIONS,
  issueZohoAccessToken,
  projectZohoCredentials,
  zohoRequest,
  type ProjectCrm,
  type ZohoCredentials
} from "@csa/mongodb";

export type ZohoApi = <T>(path: string, method?: string, body?: unknown) => Promise<T | null>;
export type ZohoProjectClient = {
  api: ZohoApi;
  /** Base for record links, e.g. https://crm.zoho.in/crm/org123; null when the region or org isn't known. */
  recordBase: string | null;
};

type Session = { accessToken: string; apiDomain: string };
const sessions = new Map<string, { session?: Session; expiresAt: number; pending?: Promise<Session> }>();

export function zohoClient(cacheKey: string, credentials: ZohoCredentials): ZohoProjectClient {
  const key = createHash("sha256").update(cacheKey).digest("hex");
  async function session(): Promise<Session> {
    let entry = sessions.get(key);
    if (entry?.session && entry.expiresAt > Date.now()) return entry.session;
    if (entry?.pending) return entry.pending;
    // Bound memory; evicted entries simply obtain a new token.
    if (sessions.size >= 500) sessions.delete(sessions.keys().next().value!);
    entry = { expiresAt: 0 };
    sessions.set(key, entry);
    const current = entry;
    current.pending = issueZohoAccessToken(credentials)
      .then(({ accessToken, apiDomain, expiresIn }) => {
        current.session = { accessToken, apiDomain };
        // Zoho limits how often a refresh token mints access tokens: reuse until 5 minutes before expiry.
        current.expiresAt = Date.now() + Math.max(expiresIn - 300, 60) * 1000;
        return current.session;
      })
      .finally(() => {
        current.pending = undefined;
      });
    return current.pending;
  }
  const web = ZOHO_REGIONS[credentials.region].web;
  return {
    recordBase: web && credentials.orgDomain ? `${web}/crm/${credentials.orgDomain}` : null,
    api: async <T>(path: string, method = "GET", body?: unknown) => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await zohoRequest<T>(await session(), path, method, body);
        } catch (error) {
          // Retry only for an expired/invalid token; a missing scope (also HTTP 401 in Zoho) won't be fixed by a new token.
          const { status, code } = error as { status?: number; code?: string };
          if (status !== 401 || code === "OAUTH_SCOPE_MISMATCH") throw error;
          sessions.delete(key);
          if (attempt === 0) continue;
          throw new Error("Zoho authorization failed. Check this project's CRM connection in Superadmin");
        }
      }
    }
  };
}

export function projectZohoClient(clientId: string, projectKey: string, settings: ProjectCrm) {
  return zohoClient(JSON.stringify([clientId, projectKey, settings]), projectZohoCredentials(settings));
}
