import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GraphQLError } from "graphql";

// Unified Search needs broad read access; keep write access limited to tickets.
export const zendeskOAuthScope = "read tickets:write";

export function error(message: string, code = "BAD_USER_INPUT"): never {
  throw new GraphQLError(message, { extensions: { code } });
}

export function zendeskConfig() {
  const subdomain = (process.env.ZENDESK_SUBDOMAIN || "")
    .trim()
    .toLowerCase()
    .replace(/^https:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\.zendesk\.com$/, "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain))
    error("Set ZENDESK_SUBDOMAIN to your Zendesk subdomain");
  return { subdomain };
}

export async function zendeskRequest<T>(
  path: string,
  init: RequestInit = {},
  subdomain = zendeskConfig().subdomain
): Promise<T> {
  if (!path.startsWith("/api/v2/") && path !== "/oauth/tokens")
    error("Invalid Zendesk API path");
  const response = await fetch(
    `https://${subdomain}.zendesk.com${path}`,
    {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json", ...init.headers }
    }
  );
  if (!response.ok) {
    if (response.status === 429)
      error(
        `Zendesk rate limit reached; retry after ${response.headers.get("retry-after") || "60"} seconds`,
        "RATE_LIMITED"
      );
    if (response.status === 401)
      error(
        "Zendesk authorization expired or was revoked. Run zendesk:authorize again",
        "UNAUTHENTICATED"
      );
    if (response.status === 403 && path.startsWith("/api/v2/search"))
      error(
        "Zendesk search access denied. Allow the read scope on the OAuth client, then run zendesk:authorize again with a Zendesk agent/admin account",
        "FORBIDDEN"
      );
    if (response.status === 403)
      error("The Zendesk user or OAuth scopes do not permit this operation", "FORBIDDEN");
    if (response.status === 404) error("Zendesk ticket not found", "NOT_FOUND");
    if (response.status === 409)
      error("Ticket changed in Zendesk. Reload before updating", "CONFLICT");
    // Vendor bodies can include customer data or credentials. Do not echo them.
    error(
      `Zendesk rejected the request (HTTP ${response.status}). Check required fields and account configuration`,
      "PROVIDER_ERROR"
    );
  }
  return response.json() as Promise<T>;
}

export function oauthCredentials() {
  const clientId = process.env.ZENDESK_CLIENT_ID?.trim();
  const clientSecret = process.env.ZENDESK_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret)
    error("Set ZENDESK_CLIENT_ID and ZENDESK_CLIENT_SECRET");
  return { client_id: clientId, client_secret: clientSecret };
}

type Tokens = { access_token: string; refresh_token?: string; expires_in: number };
type SavedTokens = Tokens & { subdomain: string; clientId: string; expiresAt: number };
export const tokenFile = fileURLToPath(
  new URL("../../.zendesk-tokens.json", import.meta.url)
);

/** Local single-process test credential store; never use this for shared deployment. */
export async function saveTokens(tokens: Tokens) {
  if (
    !tokens.access_token ||
    !Number.isFinite(tokens.expires_in) ||
    tokens.expires_in <= 0
  )
    error("Invalid Zendesk token response", "PROVIDER_ERROR");
  const saved: SavedTokens = {
    ...tokens,
    subdomain: zendeskConfig().subdomain,
    clientId: oauthCredentials().client_id,
    expiresAt: Date.now() + tokens.expires_in * 1000
  };
  const temp = `${tokenFile}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(saved), { mode: 0o600 });
  await rename(temp, tokenFile);
}

let pendingToken: Promise<string> | undefined;
export function accessToken(): Promise<string> {
  const explicit = process.env.ZENDESK_ACCESS_TOKEN?.trim();
  if (explicit) return Promise.resolve(explicit);
  // Rotating refresh tokens must not be exchanged twice by concurrent requests.
  pendingToken ||= readOrRefreshToken().finally(() => {
    pendingToken = undefined;
  });
  return pendingToken;
}

async function readOrRefreshToken() {
  let saved: SavedTokens;
  try {
    saved = JSON.parse(await readFile(tokenFile, "utf8"));
  } catch {
    error(
      "Run pnpm --filter @csa/ticketing zendesk:authorize first, or set ZENDESK_ACCESS_TOKEN",
      "CONNECTION_REQUIRED"
    );
  }
  if (
    saved.subdomain !== zendeskConfig().subdomain ||
    saved.clientId !== oauthCredentials().client_id
  )
    error(
      "Saved tokens belong to another Zendesk account/client. Run zendesk:authorize again",
      "CONNECTION_REQUIRED"
    );
  if (saved.access_token && saved.expiresAt > Date.now() + 60_000)
    return saved.access_token;
  if (!saved.refresh_token) error("Run zendesk:authorize again", "CONNECTION_REQUIRED");
  // Consume locally before exchange: after an uncertain timeout do not replay a
  // refresh token which Zendesk may already have rotated. Reauthorize instead.
  const refreshToken = saved.refresh_token;
  delete saved.refresh_token;
  await writeFile(tokenFile, JSON.stringify(saved), { mode: 0o600 });
  const tokens = await zendeskRequest<Tokens>("/oauth/tokens", {
    method: "POST",
    body: JSON.stringify({
      grant_type: "refresh_token",
      ...oauthCredentials(),
      refresh_token: refreshToken,
      expires_in: 1800
    })
  });
  await saveTokens(tokens);
  return tokens.access_token;
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return zendeskRequest<T>(`/api/v2/${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken()}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
