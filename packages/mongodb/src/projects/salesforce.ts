import { decrypt } from "../encrypt.js";
import type { ProjectCrm } from "./crm.js";

export const SALESFORCE_API_VERSION = "v62.0";

/** Salesforce My Domain origin, e.g. https://acme.my.salesforce.com (login.salesforce.com cannot issue client-credentials tokens). */
export function normalizeSalesforceInstanceUrl(value: string) {
  const raw = value.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Enter a Salesforce My Domain URL such as https://acme.my.salesforce.com");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.my\.salesforce\.com$/.test(host))
    throw new Error("Enter a Salesforce My Domain URL such as https://acme.my.salesforce.com");
  return `https://${host}`;
}

export function projectSalesforceCredentials(settings: ProjectCrm) {
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error("Configure SUPERADMIN_ENCRYPTION_KEY on admin and crm");
  if (!settings.salesforceInstanceUrl || !settings.salesforceClientId || !settings.salesforceSecretEncrypted)
    throw new Error("Project Salesforce credentials are incomplete");
  return {
    instanceUrl: normalizeSalesforceInstanceUrl(settings.salesforceInstanceUrl),
    clientId: settings.salesforceClientId,
    clientSecret: decrypt(settings.salesforceSecretEncrypted)
  };
}
export type SalesforceCredentials = ReturnType<typeof projectSalesforceCredentials>;

/**
 * OAuth 2.0 client-credentials token. Salesforce returns no `expires_in`; the
 * lifetime follows the org's session timeout, so callers cache conservatively
 * and re-issue on HTTP 401.
 */
export async function issueSalesforceServiceToken(credentials: SalesforceCredentials) {
  const instanceUrl = normalizeSalesforceInstanceUrl(credentials.instanceUrl);
  let response: Response;
  try {
    response = await fetch(`${instanceUrl}/services/oauth2/token`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      })
    });
  } catch {
    throw new Error("Could not reach Salesforce. Check the My Domain URL and connection");
  }
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    instance_url?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token)
    throw new Error(
      `Salesforce authorization failed (${body.error_description || body.error || `HTTP ${response.status}`}). Check the consumer key and secret, that Client Credentials Flow is enabled, and the Run As user`
    );
  return { accessToken: body.access_token, instanceUrl: (body.instance_url || instanceUrl).replace(/\/+$/, "") };
}
