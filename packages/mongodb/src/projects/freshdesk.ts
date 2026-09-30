import { decrypt } from "../encrypt.js";
import type { ProjectTicketing } from "./ticketing.js";

export function normalizeFreshdeskDomain(value: string) {
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^https:\/\//, "")
    .replace(/\/$/, "");
  const host = domain.endsWith(".freshdesk.com") ? domain : `${domain}.freshdesk.com`;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.freshdesk\.com$/.test(host))
    throw new Error("Enter a Freshdesk domain such as royalcyber-help.freshdesk.com");
  return host;
}
export function projectFreshdeskCredentials(settings: ProjectTicketing) {
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error("Configure SUPERADMIN_ENCRYPTION_KEY on admin and ticketing");
  if (!settings.freshdeskDomain || !settings.freshdeskApiKeyEncrypted)
    throw new Error("Project Freshdesk credentials are incomplete");
  return {
    domain: normalizeFreshdeskDomain(settings.freshdeskDomain),
    apiKey: decrypt(settings.freshdeskApiKeyEncrypted)
  };
}
export type FreshdeskCredentials = ReturnType<typeof projectFreshdeskCredentials>;
export function freshdeskClient(credentials: FreshdeskCredentials) {
  const domain = normalizeFreshdeskDomain(credentials.domain);
  return async function request<T>(
    path: string,
    method = "GET",
    body?: unknown
  ): Promise<T> {
    if (
      !/^(tickets|ticket_fields|agents|contacts)([/?]|$)/.test(path) ||
      path.includes("..") ||
      path.includes("#")
    )
      throw new Error("Invalid Freshdesk API path");
    let response: Response;
    try {
      response = await fetch(`https://${domain}/api/v2/${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          authorization: `Basic ${Buffer.from(`${credentials.apiKey}:X`).toString("base64")}`,
          "content-type": "application/json"
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    } catch {
      throw new Error("Could not reach Freshdesk. Check the domain and connection");
    }
    if (!response.ok) {
      const error = new Error(
        response.status === 429
          ? `Freshdesk rate limit reached; retry after ${response.headers.get("retry-after") || "60"} seconds`
          : `Freshdesk request failed (HTTP ${response.status}). Check the API key, agent permissions and required ticket fields`
      );
      Object.assign(error, { status: response.status });
      throw error;
    }
    return response.json() as Promise<T>;
  };
}
