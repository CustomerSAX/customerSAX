type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};
import type { CommercetoolsProjectConfig } from "./project-config.js";

const cachedTokens = new Map<string, { expiresAt: number; token: string }>();

export async function getCommercetoolsToken(config: CommercetoolsProjectConfig) {
  const cacheKey = `${config.projectKey}:${config.clientId}`;
  const cachedToken = cachedTokens.get(cacheKey);
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const scope = config.scope || `manage_project:${config.projectKey}`;

  const response = await fetch(`${config.authUrl}/oauth/token`, {
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope
    }),
    headers: {
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`commercetools auth failed with ${response.status}: ${await safeErrorMessage(response)}`);
  }

  const payload = (await response.json()) as TokenResponse;

  cachedTokens.set(cacheKey, {
    expiresAt: Date.now() + payload.expires_in * 1000,
    token: payload.access_token
  });

  return payload.access_token;
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
