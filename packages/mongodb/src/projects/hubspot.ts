import { decrypt } from "../encrypt.js";
import type { ProjectCrm } from "./crm.js";

const HUBSPOT_API = "https://api.hubapi.com";

/**
 * Scopes CSA needs on the HubSpot service key (or legacy private app). Calls,
 * meetings, notes and tasks are covered by the contacts scopes.
 */
export const HUBSPOT_REQUIRED_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.owners.read",
  "sales-email-read"
];

export function projectHubspotCredentials(settings: ProjectCrm) {
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error("Configure SUPERADMIN_ENCRYPTION_KEY on admin and crm");
  if (!settings.hubspotTokenEncrypted) throw new Error("Project HubSpot credentials are incomplete");
  return {
    accessToken: decrypt(settings.hubspotTokenEncrypted),
    portalId: settings.hubspotPortalId ?? null
  };
}
export type HubspotCredentials = ReturnType<typeof projectHubspotCredentials>;

/**
 * The HubSpot web app host for record links, from the private-app token's
 * region prefix (pat-na1-… → app.hubspot.com, pat-eu1-… → app-eu1.hubspot.com).
 */
export function hubspotUiDomain(accessToken: string) {
  const region = /^pat-([a-z]{2}\d)-/.exec(accessToken)?.[1];
  return !region || region === "na1" ? "app.hubspot.com" : `app-${region}.hubspot.com`;
}

async function getJson(url: string, init: RequestInit) {
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
    return response.ok ? ((await response.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The HubSpot account (Hub / portal) ID behind a token, or null when HubSpot
 * won't say. Tries the private-app token-info endpoint, then account-info
 * (needs the `oauth` scope). Service keys may support neither; callers then
 * leave record links empty rather than guessing an account.
 */
export async function hubspotAccountId(accessToken: string): Promise<string | null> {
  const headers = { "content-type": "application/json", authorization: `Bearer ${accessToken}` };
  // EU tokens are only accepted as a Bearer header; NA tokens in the body. Send both.
  const info = await getJson(`${HUBSPOT_API}/oauth/v2/private-apps/get/access-token-info`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tokenKey: accessToken })
  });
  if (info?.hubId !== undefined && info.hubId !== null) return String(info.hubId);
  const account = await getJson(`${HUBSPOT_API}/account-info/v3/details`, { headers });
  if (account?.portalId !== undefined && account.portalId !== null) return String(account.portalId);
  return null;
}

const ALLOWED_PATH =
  /^crm\/v3\/(objects\/(contacts|companies|calls|emails|meetings|notes|tasks)(\/(\d+|search|batch\/read))?|owners(\/\d+)?)(\?[^#]*)?$/;

/**
 * Request helper for the HubSpot CRM v3 API with a private-app token. Returns
 * null for 404 (not found) and 204; throws for other failures without echoing
 * vendor bodies (they can contain customer data).
 */
export function hubspotClient(credentials: HubspotCredentials) {
  return async function request<T>(path: string, method = "GET", body?: unknown): Promise<T | null> {
    if (!ALLOWED_PATH.test(path) || path.includes("..")) throw new Error("Invalid HubSpot API path");
    let response: Response;
    try {
      response = await fetch(`${HUBSPOT_API}/${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          authorization: `Bearer ${credentials.accessToken}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    } catch {
      throw new Error("Could not reach HubSpot. Check the connection");
    }
    if (response.status === 404 || response.status === 204) return null;
    if (!response.ok) {
      const category = ((await response.json().catch(() => ({}))) as { category?: string }).category;
      const message =
        response.status === 401
          ? "HubSpot rejected the access token. Check this project's CRM connection in Superadmin"
          : response.status === 403
            ? `The HubSpot service key is missing a required scope (${HUBSPOT_REQUIRED_SCOPES.join(", ")})`
            : response.status === 429
              ? `HubSpot rate limit reached; retry after ${response.headers.get("retry-after") || "10"} seconds`
              : `HubSpot rejected the request (HTTP ${response.status}${category ? `, ${category}` : ""}). Check the values sent`;
      const error = new Error(message);
      Object.assign(error, { status: response.status });
      throw error;
    }
    return (await response.json()) as T;
  };
}
export type HubspotRequest = ReturnType<typeof hubspotClient>;
