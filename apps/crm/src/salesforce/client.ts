import { GraphQLError } from "graphql";
import { SALESFORCE_API_VERSION } from "@csa/mongodb";

export function error(message: string, code = "BAD_USER_INPUT"): never {
  throw new GraphQLError(message, { extensions: { code } });
}

const ALLOWED_PATH = /^(query\?|search\?|sobjects\/(Contact|Task)(\/[a-zA-Z0-9]{15,18})?$)/;

/**
 * One Salesforce REST call under /services/data/{version}/. Returns null for
 * 204 (no body) and 404 (record not found); throws a coded GraphQLError for
 * everything else. Vendor error bodies can contain customer data, so only the
 * Salesforce error code is surfaced, never the message body.
 */
export async function salesforceRequest<T>(
  instanceUrl: string,
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T | null> {
  if (!ALLOWED_PATH.test(path) || path.includes("..") || path.includes("#")) error("Invalid Salesforce API path");
  const response = await fetch(`${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/${path}`, {
    method: init.method ?? "GET",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      ...(init.body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
  });
  if (response.status === 204 || response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 401) error("Salesforce authorization expired or was revoked", "UNAUTHENTICATED");
    if (response.status === 403)
      error("The Salesforce Run As user does not have permission for this operation", "FORBIDDEN");
    const body = (await response.json().catch(() => undefined)) as Array<{ errorCode?: string }> | undefined;
    const code = Array.isArray(body) ? body[0]?.errorCode : undefined;
    error(
      `Salesforce rejected the request (HTTP ${response.status}${code ? `, ${code}` : ""}). Check required fields and the Run As user's permissions`,
      response.status === 400 ? "BAD_USER_INPUT" : "PROVIDER_ERROR"
    );
  }
  return response.json() as Promise<T>;
}
