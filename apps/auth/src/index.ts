import { createServer } from "node:http";
import "./load-env.js";
import { getCurrentSession, loginWithPassword, logout } from "./http/auth.js";
import { readJsonBody, sendJson, sendNoContent } from "./http/json.js";
import { ensureAuthIndexes } from "./users/repository.js";

const port = Number(process.env.AUTH_PORT ?? process.env.PORT ?? 4360);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

await ensureAuthIndexes();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

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

      const session = await loginWithPassword(body.email, body.password);

      if (!session) {
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

    if (request.method === "DELETE" && url.pathname === "/sessions/current") {
      await logout(request);
      sendNoContent(response);
      return;
    }

    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    console.error("[auth]", error);
    sendJson(response, 500, { error: "internal server error" });
  }
});

server.listen(port, host, () => {
  console.log(`CSA auth service ready at http://${host}:${port}`);
});
