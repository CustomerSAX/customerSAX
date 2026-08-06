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
  const authUrl = requiredEnv("COMMERCETOOLS_AUTH_URL");
  const scope =
    process.env.COMMERCETOOLS_SCOPE ??
    `manage_project:${requiredEnv("COMMERCETOOLS_PROJECT_KEY")}`;

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
    throw new Error(`commercetools auth failed with ${response.status}`);
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

