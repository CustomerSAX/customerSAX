import { decrypt } from "../encrypt.js";
import type { ProjectCrm } from "./crm.js";

/**
 * Zoho data centers. Tokens only work against the accounts server of the org's
 * own region; `web` builds record links and is left out where unconfirmed.
 */
export const ZOHO_REGIONS = {
  us: { label: "United States (zoho.com)", accounts: "https://accounts.zoho.com", web: "https://crm.zoho.com" },
  eu: { label: "Europe (zoho.eu)", accounts: "https://accounts.zoho.eu", web: "https://crm.zoho.eu" },
  in: { label: "India (zoho.in)", accounts: "https://accounts.zoho.in", web: "https://crm.zoho.in" },
  au: { label: "Australia (zoho.com.au)", accounts: "https://accounts.zoho.com.au", web: "https://crm.zoho.com.au" },
  jp: { label: "Japan (zoho.jp)", accounts: "https://accounts.zoho.jp", web: "https://crm.zoho.jp" },
  cn: { label: "China (zoho.com.cn)", accounts: "https://accounts.zoho.com.cn", web: "https://crm.zoho.com.cn" },
  ca: { label: "Canada (zohocloud.ca)", accounts: "https://accounts.zohocloud.ca", web: null },
  sa: { label: "Saudi Arabia (zoho.sa)", accounts: "https://accounts.zoho.sa", web: null }
} as const;
export type ZohoRegion = keyof typeof ZOHO_REGIONS;

export function isZohoRegion(value: string): value is ZohoRegion {
  return Object.prototype.hasOwnProperty.call(ZOHO_REGIONS, value);
}

/** Scopes to enter in the Self Client when generating the grant code. */
export const ZOHO_SCOPES = [
  "ZohoCRM.modules.contacts.ALL",
  "ZohoCRM.modules.accounts.READ",
  "ZohoCRM.modules.calls.ALL",
  "ZohoCRM.modules.tasks.ALL",
  "ZohoCRM.modules.events.READ",
  "ZohoCRM.modules.notes.READ",
  "ZohoCRM.org.READ",
  "ZohoSearch.securesearch.READ"
];

export type ZohoCredentials = {
  region: ZohoRegion;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  orgDomain: string | null;
};

export function projectZohoCredentials(settings: ProjectCrm): ZohoCredentials {
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error("Configure SUPERADMIN_ENCRYPTION_KEY on admin and crm");
  if (!settings.zohoRegion || !isZohoRegion(settings.zohoRegion) || !settings.zohoClientId || !settings.zohoSecretEncrypted || !settings.zohoRefreshTokenEncrypted)
    throw new Error("Project Zoho credentials are incomplete");
  return {
    region: settings.zohoRegion,
    clientId: settings.zohoClientId,
    clientSecret: decrypt(settings.zohoSecretEncrypted),
    refreshToken: decrypt(settings.zohoRefreshTokenEncrypted),
    orgDomain: settings.zohoOrgDomain ?? null
  };
}

type TokenBody = { access_token?: string; refresh_token?: string; api_domain?: string; expires_in?: number; error?: string };

async function tokenRequest(region: ZohoRegion, params: Record<string, string>): Promise<TokenBody> {
  let response: Response;
  try {
    response = await fetch(`${ZOHO_REGIONS[region].accounts}/oauth/v2/token`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params)
    });
  } catch {
    throw new Error("Could not reach Zoho. Check the region and connection");
  }
  // Zoho reports token errors as HTTP 200 with an `error` field.
  const body = (await response.json().catch(() => ({}))) as TokenBody;
  if (!response.ok || body.error) {
    const reason = body.error ?? `HTTP ${response.status}`;
    const hint =
      reason === "invalid_code"
        ? "The grant code is invalid or expired (codes work once, for a few minutes). Generate a new one in the Self Client"
        : reason === "invalid_client"
          ? "The client ID or secret is wrong, or belongs to another Zoho region"
          : `Zoho authorization failed (${reason})`;
    throw new Error(hint);
  }
  return body;
}

/** Exchanges a one-time Self Client grant code for a long-lived refresh token. */
export async function exchangeZohoGrantCode(region: ZohoRegion, clientId: string, clientSecret: string, code: string) {
  const body = await tokenRequest(region, { grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code });
  if (!body.refresh_token || !body.access_token || !body.api_domain)
    throw new Error("Zoho did not return a refresh token. Generate a new grant code and try again");
  return { refreshToken: body.refresh_token, accessToken: body.access_token, apiDomain: body.api_domain.replace(/\/+$/, "") };
}

/** A fresh access token (valid one hour) plus the org's API domain. */
export async function issueZohoAccessToken(credentials: Pick<ZohoCredentials, "region" | "clientId" | "clientSecret" | "refreshToken">) {
  const body = await tokenRequest(credentials.region, {
    grant_type: "refresh_token",
    refresh_token: credentials.refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret
  });
  if (!body.access_token || !body.api_domain) throw new Error("Zoho did not return an access token");
  return { accessToken: body.access_token, apiDomain: body.api_domain.replace(/\/+$/, ""), expiresIn: body.expires_in ?? 3600 };
}

const ALLOWED_PATH =
  /^((Contacts|Accounts|Calls|Tasks|Events|Notes)(\/(\d+(\/(Calls|Tasks|Events|Notes|Contacts|Activities_Chronological_View_History))?|search))?|org)(\?[^#]*)?$/;

/**
 * One Zoho CRM v8 call. Returns null for 204 (no records) and 404; throws for
 * other failures without echoing vendor bodies beyond Zoho's error code.
 */
export async function zohoRequest<T>(
  session: { accessToken: string; apiDomain: string },
  path: string,
  method = "GET",
  body?: unknown
): Promise<T | null> {
  if (!ALLOWED_PATH.test(path) || path.includes("..")) throw new Error("Invalid Zoho API path");
  let response: Response;
  try {
    response = await fetch(`${session.apiDomain}/crm/v8/${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        authorization: `Zoho-oauthtoken ${session.accessToken}`,
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new Error("Could not reach Zoho. Check the connection");
  }
  if (response.status === 204 || response.status === 404) return null;
  const json = (await response.json().catch(() => ({}))) as { code?: string } & Record<string, unknown>;
  if (!response.ok) {
    const code = json.code;
    const message =
      // Zoho answers a missing scope with 401 too; only INVALID_TOKEN means the token itself is bad.
      code === "OAUTH_SCOPE_MISMATCH" || response.status === 403
        ? `The Zoho connection doesn't have permission for this (missing scope; required: ${ZOHO_SCOPES.join(", ")})`
        : response.status === 401
          ? "Zoho rejected the access token"
          : response.status === 429
            ? "Zoho API limit reached; retry shortly"
            : `Zoho rejected the request (HTTP ${response.status}${code ? `, ${code}` : ""}). Check the values sent`;
    throw Object.assign(new Error(message), { status: response.status, code });
  }
  return json as T;
}

/** Org identifiers: id reserves the account per project; domain_name builds record links. */
export async function zohoOrg(session: { accessToken: string; apiDomain: string }) {
  const body = await zohoRequest<{ org?: Array<{ id?: string; domain_name?: string }> }>(session, "org");
  const org = body?.org?.[0];
  return { orgId: org?.id ? String(org.id) : null, orgDomain: org?.domain_name ?? null };
}
