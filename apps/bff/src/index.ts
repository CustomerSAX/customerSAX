import http from "http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import "./server/env.js";
import { apolloContext, apolloLoggingPlugin, createLogger } from "@csa/logger";
import { buildGateway, type GatewayContext } from "./server/federation.js";
import { localSchema } from "./server/local-schema.js";

const log = createLogger("bff");
// Cloud Run sets PORT=8080. BFF_PORT is a legacy fallback kept for local dev.
const port = Number(process.env.PORT ?? process.env.BFF_PORT ?? 4000);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

/**
 * The Apollo Gateway composes every subgraph at boot via IntrospectAndCompose.
 * Under `turbo --parallel` (or any simultaneous start) a subgraph may not be
 * listening yet when the BFF comes up, and the gateway's INITIAL compose throws
 * hard — crashing the process. (The `pollIntervalInMs` only recovers changes
 * AFTER a successful first compose, not the initial one.)
 *
 * On Cloud Run the startup probe requires the port to be bound BEFORE the
 * health-check timeout. `startStandaloneServer` calls `server.start()` (which
 * runs IntrospectAndCompose) BEFORE it calls `httpServer.listen()` — so the
 * port was never bound during the retry spin and Cloud Run killed the revision.
 *
 * Fix: bind the HTTP server + /healthz immediately, then compose the gateway
 * in the background with retries. Once composition succeeds, GraphQL traffic
 * is mounted at /graphql. Cloud Run is happy from the first health-check tick.
 */
const MAX_ATTEMPTS = Number(process.env.BFF_BOOT_MAX_ATTEMPTS ?? 12);
const RETRY_MS = Number(process.env.BFF_BOOT_RETRY_MS ?? 5000);

const app = express();
const httpServer = http.createServer(app);

// ── Health check: responds immediately so Cloud Run startup probe passes ──────
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

// ── Start HTTP server immediately — Cloud Run sees port 8080 right away ───────
await new Promise<void>((resolve) => httpServer.listen({ port, host }, resolve));
log.info("http server listening", { port, host });

// ── Compose gateway in the background with retries ────────────────────────────
async function composeGateway(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const gateway = buildGateway(log);
    const server = gateway
      ? new ApolloServer<GatewayContext>({
          gateway,
          plugins: [apolloLoggingPlugin(log), ApolloServerPluginDrainHttpServer({ httpServer })]
        })
      : new ApolloServer<GatewayContext>({
          ...localSchema,
          plugins: [apolloLoggingPlugin(log), ApolloServerPluginDrainHttpServer({ httpServer })]
        });
    try {
      await server.start();
      app.use(
        "/graphql",
        cors<cors.CorsRequest>(),
        express.json(),
        expressMiddleware<GatewayContext>(server, {
          context: async ({ req }) => apolloContext(req)
        })
      );
      log.info("gateway ready — graphql serving", { attempt });
      return;
    } catch (err) {
      await server.stop().catch(() => {});
      if (attempt >= MAX_ATTEMPTS) {
        log.error("gateway failed to compose after retries; giving up", err, { attempt });
        // Don't throw — keep the healthz endpoint alive so Cloud Run doesn't restart.
        return;
      }
      log.warn("gateway compose failed (a subgraph may not be ready yet); retrying", {
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        retryMs: RETRY_MS
      });
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }
}

composeGateway().catch((err) => log.error("composeGateway uncaught error", err));
