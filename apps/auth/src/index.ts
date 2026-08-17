import { createServer } from "node:http";
import "./env.js";
import { createLogger, withHttpContext } from "@csa/logger";
import { getCurrentSession, loginWithPassword, logout, selectSessionProject } from "./http/auth.js";
import { HttpError, readJsonBody, sendJson, sendNoContent } from "./http/json.js";
import {
  applyCors,
  checkLoginThrottle,
  getClientIp,
  handlePreflight,
  recordLoginFailure
} from "./http/security.js";
import { ensureAuthIndexes } from "./users/repository.js";

const log = createLogger("auth");
const port = Number(process.env.AUTH_PORT ?? process.env.PORT ?? 4360);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

await ensureAuthIndexes();

const server = createServer(withHttpContext(log, async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    // CORS preflight: answer OPTIONS before any routing. Non-allowlisted origins
    // are denied here; server-side (no-Origin) callers never send OPTIONS.
    if (handlePreflight(request, response)) {
      return;
    }

    // Attach CORS headers to actual responses for allowlisted browser origins.
    // No-op (no headers) for server-side calls with no Origin — that path is
    // deliberately unaffected so the studio's Next route handlers keep working.
    applyCors(request, response);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: "auth" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/sessions") {
      const body = await readJsonBody<{ email?: string; password?: string }>(request);

      if (!body.email?.trim() || !body.password) {
        sendJson(response, 400, { error: "email and password are required" });
        return;
      }

      // Brute-force throttle: block once recent FAILED attempts for this IP OR
      // this account email exceed the threshold. Read-only pre-check, so a
      // correct-credential login is never counted against the limit. The 429
      // message is intentionally generic — it must NOT reveal whether the IP or
      // the email tripped. Degrades open when Redis is down (see security.ts).
      const clientIp = getClientIp(request);
      const throttle = await checkLoginThrottle(clientIp, body.email);
      if (throttle.blocked) {
        sendJson(
          response,
          429,
          { error: "too many login attempts — please try again later" },
          { "retry-after": String(throttle.retryAfterSeconds) }
        );
        return;
      }

      const session = await loginWithPassword(body.email, body.password);

      if (!session) {
        // Count this failure against both IP and account-email windows.
        await recordLoginFailure(clientIp, body.email);
        sendJson(response, 401, { error: "invalid credentials" });
        return;
      }

      sendJson(response, 201, session);
      return;
    }

    if (request.method === "GET" && url.pathname === "/sessions/current") {
      const session = await getCurrentSession(request);

      if (!session) {
        sendJson(response, 401, { error: "unauthenticated" });
        return;
      }

      sendJson(response, 200, session);
      return;
    }

    if (request.method === "POST" && url.pathname === "/sessions/current/project") {
      const body = await readJsonBody<{ projectKey?: string; clientId?: string }>(request);
      if (!body.projectKey?.trim()) {
        sendJson(response, 400, { error: "projectKey is required" });
        return;
      }
      const result = await selectSessionProject(request, body.projectKey.trim(), body.clientId?.trim());
      if (!result) {
        sendJson(response, 401, { error: "unauthenticated" });
        return;
      }
      if ("forbidden" in result) {
        sendJson(response, 403, { error: "project access denied" });
        return;
      }
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "DELETE" && url.pathname === "/sessions/current") {
      await logout(request);
      sendNoContent(response);
      return;
    }

    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    if (error instanceof HttpError) {
      // Client-attributable error (e.g. malformed JSON) — respond with its
      // specific status and rep-safe message instead of a generic 500.
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }
    log.error("request failed", error);
    sendJson(response, 500, { error: "internal server error" });
  }
}));

server.listen(port, host, () => {
  log.info("service ready", { host, port });
});
