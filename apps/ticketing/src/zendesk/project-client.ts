import { createHash } from "node:crypto";
import {
  issueZendeskServiceToken,
  projectZendeskCredentials,
  type ProjectTicketing
} from "@csa/mongodb";
import { zendeskRequest, type api } from "./client.js";

const tokens = new Map<
  string,
  { token?: string; expiresAt: number; pending?: Promise<string> }
>();
export function projectZendeskClient(
  clientId: string,
  projectKey: string,
  settings: ProjectTicketing
): { subdomain: string; api: typeof api } {
  const credentials = projectZendeskCredentials(settings);
  const key = createHash("sha256")
    .update(JSON.stringify([clientId, projectKey, settings]))
    .digest("hex");
  async function accessToken() {
    let entry = tokens.get(key);
    if (entry?.token && entry.expiresAt > Date.now() + 60_000) return entry.token;
    if (entry?.pending) return entry.pending;
    // Bound memory; expired/evicted entries can safely obtain a new client-credentials token.
    if (tokens.size >= 500) tokens.delete(tokens.keys().next().value!);
    entry = { expiresAt: 0 };
    tokens.set(key, entry);
    const current = entry;
    current.pending = issueZendeskServiceToken(credentials)
      .then((token) => {
        current.token = token.access_token;
        current.expiresAt = Date.now() + token.expires_in * 1000;
        return token.access_token;
      })
      .finally(() => {
        current.pending = undefined;
      });
    return current.pending;
  }
  return {
    subdomain: credentials.subdomain,
    api: async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
      try {
        return await zendeskRequest<T>(
          `/api/v2/${path}`,
          {
            method,
            headers: { authorization: `Bearer ${await accessToken()}` },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
          },
          credentials.subdomain
        );
      } catch (error) {
        if (
          (error as { extensions?: { code?: string } }).extensions?.code ===
          "UNAUTHENTICATED"
        ) {
          tokens.delete(key);
          throw new Error(
            "Zendesk authorization failed. Check this project's Ticketing connection in Superadmin"
          );
        }
        throw error;
      }
    }
  };
}
