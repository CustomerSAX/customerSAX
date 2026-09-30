import "../env.js";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { oauthCredentials, saveTokens, zendeskConfig, zendeskRequest, zendeskOAuthScope } from "./client.js";

// A one-shot localhost authorization helper, independent of Studio/admin/BFF.
const redirect = new URL(
  process.env.ZENDESK_REDIRECT_URI || "http://localhost:4351/callback"
);
if (
  redirect.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(redirect.hostname) ||
  redirect.username ||
  redirect.password ||
  redirect.search ||
  redirect.hash ||
  redirect.pathname === "/"
) {
  throw new Error(
    "For this local helper, use an HTTP localhost callback such as http://localhost:4351/callback"
  );
}
const credentials = oauthCredentials();
const state = randomBytes(32).toString("hex");
const browserNonce = randomBytes(32).toString("hex");
const verifier = randomBytes(32).toString("base64url");
const authorization = new URL(
  `https://${zendeskConfig().subdomain}.zendesk.com/oauth/authorizations/new`
);
authorization.search = new URLSearchParams({
  response_type: "code",
  client_id: credentials.client_id,
  redirect_uri: redirect.href,
  state,
  scope: zendeskOAuthScope,
  code_challenge_method: "S256",
  code_challenge: createHash("sha256").update(verifier).digest("base64url")
}).toString();
let consumed = false;
const server = createServer(async (req, res) => {
  res.setHeader("cache-control", "no-store");
  res.setHeader("referrer-policy", "no-referrer");
  if (req.headers.host !== redirect.host || req.method !== "GET") {
    res.writeHead(400).end("Invalid request");
    return;
  }
  const url = new URL(req.url || "/", redirect.origin);
  if (url.pathname === "/" && !consumed) {
    res.setHeader(
      "set-cookie",
      `csa_zendesk_local=${browserNonce}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
    );
    res.writeHead(302, { location: authorization.href }).end();
    return;
  }
  if (url.pathname !== redirect.pathname) {
    res.writeHead(404).end();
    return;
  }
  const bound = req.headers.cookie
    ?.split(";")
    .some((c) => c.trim() === `csa_zendesk_local=${browserNonce}`);
  if (consumed || !bound || url.searchParams.get("state") !== state) {
    res.writeHead(400).end("Invalid or expired authorization. Restart the command.");
    return;
  }
  consumed = true;
  res.setHeader(
    "set-cookie",
    "csa_zendesk_local=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  );
  try {
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error"))
      throw new Error("Authorization was not granted");
    const tokens = await zendeskRequest<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("/oauth/tokens", {
      method: "POST",
      body: JSON.stringify({
        grant_type: "authorization_code",
        ...credentials,
        code,
        redirect_uri: redirect.href,
        code_verifier: verifier,
        scope: zendeskOAuthScope,
        expires_in: 1800
      })
    });
    await saveTokens(tokens);
    res.end(
      "Zendesk authorized. You can close this tab and start the ticketing service."
    );
    console.log("Zendesk authorized. Tokens saved locally; no credentials were printed.");
  } catch {
    res
      .writeHead(400)
      .end("Authorization failed. Check OAuth configuration and restart the command.");
    console.error("Zendesk authorization failed. Check OAuth configuration and retry.");
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    server.close();
  }
});
const timeout = setTimeout(() => {
  console.error("Authorization timed out; restart the command.");
  server.close();
}, 10 * 60_000);
server.on("error", () => {
  clearTimeout(timeout);
  console.error("Could not start localhost callback listener; check the port.");
  process.exitCode = 1;
});
server.listen(Number(redirect.port || 80), redirect.hostname, () =>
  console.log(
    `Open ${redirect.origin}/ to authorize Zendesk. Registered callback: ${redirect.href}`
  )
);
