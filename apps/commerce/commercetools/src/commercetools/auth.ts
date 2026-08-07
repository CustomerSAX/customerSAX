type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

let cachedToken: { expiresAt: number; token: string } | undefined;

export async function getCommercetoolsToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = requiredEnv("COMMERCETOOLS_CLIENT_ID");
  const clientSecret = requiredEnv("COMMERCETOOLS_CLIENT_SECRET");
  const authUrl = trimTrailingSlash(requiredEnv("COMMERCETOOLS_AUTH_URL"));
  const projectKey = requiredEnv("COMMERCETOOLS_PROJECT_KEY");
  const scope = process.env.COMMERCETOOLS_SCOPE?.trim() || `manage_project:${projectKey}`;

  const response = await fetch(`${authUrl}/oauth/token`, {
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope
    }),
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`commercetools auth failed with ${response.status}: ${await safeErrorMessage(response)}`);
  }

  const payload = (await response.json()) as TokenResponse;

  cachedToken = {
    expiresAt: Date.now() + payload.expires_in * 1000,
    token: payload.access_token
  };

  return cachedToken.token;
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, "");
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
