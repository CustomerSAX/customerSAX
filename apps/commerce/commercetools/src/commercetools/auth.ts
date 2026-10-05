import { getOrSet, ctToken } from "@csa/cache";
import type { CommercetoolsProjectConfig } from "./project-config.js";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

/** Cached shape — the token plus its own `expires_in` so the TTL can honour it. */
type CachedToken = {
  token: string;
  expiresIn: number;
};

export async function getCommercetoolsToken(config: CommercetoolsProjectConfig) {
  // `getOrSet` provides single-flight: a burst of concurrent requests on a cold
  // cache collapses to ONE token fetch instead of each hammering the CT auth
  // endpoint. Behaviour-preserving otherwise — the TTL is derived from the
  // token's own `expires_in`, minus the same 60s safety buffer the previous
  // hand-rolled `Map` used (`expiresAt > Date.now() + 60_000`).
  const cached = await getOrSet<CachedToken>(
    ctToken(config.projectKey, config.clientId),
    (value) => Math.max(value.expiresIn - 60, 1),
    async () => {
      const rawScope = config.scope?.trim();
      const customScope = rawScope && rawScope !== "manage_project:" ? rawScope : undefined;
      const initialScope = customScope || (config.projectKey ? `manage_project:${config.projectKey}` : undefined);

      const body = new URLSearchParams({
        grant_type: "client_credentials"
      });
      if (initialScope) {
        body.set("scope", initialScope);
      }

      let response = await fetch(`${config.authUrl}/oauth/token`, {
        body,
        headers: {
          authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });

      // If Commercetools rejected the scope and no explicit custom scope was provided,
      // retry without the scope parameter so Commercetools automatically grants all scopes assigned to this client.
      if (!response.ok && !customScope) {
        const retryResponse = await fetch(`${config.authUrl}/oauth/token`, {
          body: new URLSearchParams({ grant_type: "client_credentials" }),
          headers: {
            authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded"
          },
          method: "POST"
        });
        if (retryResponse.ok) {
          response = retryResponse;
        }
      }

      if (!response.ok) {
        throw new Error(`commercetools auth failed with ${response.status}: ${await safeErrorMessage(response)}`);
      }

      const payload = (await response.json()) as TokenResponse;

      return { token: payload.access_token, expiresIn: payload.expires_in };
    }
  );

  return cached.token;
}

async function safeErrorMessage(response: Response) {
  const body = await response.text().catch(() => "");

  if (!body) {
    return response.statusText || "empty response";
  }

  try {
    const parsed = JSON.parse(body) as { error?: string; error_description?: string; message?: string };

    return parsed.error_description ?? parsed.message ?? parsed.error ?? "request rejected";
  } catch {
    return body.slice(0, 300);
  }
}
