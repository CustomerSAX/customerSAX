import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import "./server/env.js";
import { apolloContext, apolloLoggingPlugin, createLogger } from "@csa/logger";
import { buildGateway, type GatewayContext } from "./server/federation.js";
import { localSchema } from "./server/local-schema.js";

const log = createLogger("bff");
const port = Number(process.env.BFF_PORT ?? 4000);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

/**
 * The Apollo Gateway composes every subgraph at boot via IntrospectAndCompose.
 * Under `turbo --parallel` (or any simultaneous start) a subgraph may not be
 * listening yet when the BFF comes up, and the gateway's INITIAL compose throws
 * hard — crashing the process. (The `pollIntervalInMs` only recovers changes
 * AFTER a successful first compose, not the initial one.) So retry the whole
 * boot with backoff: the startup race degrades to "waits a few seconds" instead
 * of a crash. A fresh gateway + server is built each attempt because a failed
 * ApolloServer cannot be re-started.
 */
const MAX_ATTEMPTS = Number(process.env.BFF_BOOT_MAX_ATTEMPTS ?? 12);
const RETRY_MS = Number(process.env.BFF_BOOT_RETRY_MS ?? 2000);

async function startBff(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const gateway = buildGateway(log);
    const server = gateway
      ? new ApolloServer({ gateway, plugins: [apolloLoggingPlugin(log)] })
      : new ApolloServer({ ...localSchema, plugins: [apolloLoggingPlugin(log)] });
    try {
      const { url } = await startStandaloneServer(server, {
        listen: { host, port },
        context: async ({ req }): Promise<GatewayContext> => apolloContext(req)
      });
      log.info("service ready", { url, attempt });
      return;
    } catch (err) {
      await server.stop().catch(() => {});
      if (attempt >= MAX_ATTEMPTS) {
        log.error("gateway failed to compose after retries; giving up", err, { attempt });
        throw err;
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

await startBff();
