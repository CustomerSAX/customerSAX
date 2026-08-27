/**
 * `@csa/service-bootstrap` — the shared Apollo-subgraph startup for CSA.
 *
 * Every CSA subgraph (`commercetools`, `ticketing`, `admin`, and the
 * `bigcommerce`/`shopify`/`sfcc` stubs) used to copy-paste the same
 * `ApolloServer` boilerplate: the logging plugin, the `K_SERVICE`-aware host,
 * the `@csa/logger`/`@csa/headers` request-context wiring, and the "service
 * ready" startup log. This package owns that once so a subgraph entrypoint
 * only has to build its schema and call `startSubgraph`.
 *
 * ## Cloud Run startup probe fix
 *
 * `startStandaloneServer` calls `server.start()` (schema init) BEFORE
 * `httpServer.listen()`. On Cloud Run the startup probe checks for a listening
 * port immediately, so any blocking initialisation (DB index creation, schema
 * build, etc.) would push `listen()` past the probe timeout and kill the revision.
 *
 * Fix: bind the HTTP server to the port FIRST (port is open in <1 ms), mount
 * a /health liveness endpoint, then call `server.start()` afterwards.
 * Cloud Run sees the port immediately and the revision is considered healthy.
 */
import http from "node:http";
import type { IncomingMessage } from "node:http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { apolloContext, apolloLoggingPlugin, createLogger, type RequestContext } from "@csa/logger";
import type { GraphQLSchema } from "graphql";

/** A request bag as Apollo hands it to the `context({ req })` factory. */
type ContextRequest = { headers: IncomingMessage["headers"] };

export interface StartSubgraphOptions {
  /** Logical service name — labels the logger (e.g. `"commercetools"`). */
  serviceName: string;
  /** The federated subgraph schema (already built via `buildSubgraphSchema`). */
  schema: GraphQLSchema;
  /** Port to listen on. */
  port: number;
  /**
   * Host to bind. Defaults to the K_SERVICE-aware choice used across CSA:
   * `0.0.0.0` on Cloud Run, `127.0.0.1` locally (overridable via `HOST`).
   */
  host?: string;
  /**
   * Optional per-request hook run after the shared RequestContext is built and
   * before it is returned as the Apollo contextValue. Used by the commercetools
   * subgraph to `activateProjectContext(context)` for tenant routing.
   */
  onContext?: (context: RequestContext, req: ContextRequest) => void | Promise<void>;
}

/** The default host CSA services bind to (Cloud Run vs. local). */
export function resolveHost(): string {
  return process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");
}

/**
 * Boots a CSA Apollo subgraph. Port is bound IMMEDIATELY so Cloud Run's
 * startup probe passes without waiting for server.start() or DB init.
 */
export async function startSubgraph({ serviceName, schema, port, host, onContext }: StartSubgraphOptions) {
  const log = createLogger(serviceName);
  const resolvedHost = host ?? resolveHost();

  const app = express();
  const httpServer = http.createServer(app);

  // Liveness: port is open instantly, Cloud Run startup probe passes right away
  app.get("/health", (_req, res) => res.json({ ok: true, service: serviceName }));

  // Bind port BEFORE server.start() so Cloud Run sees the port immediately
  await new Promise<void>((resolve) => httpServer.listen({ port, host: resolvedHost }, resolve));

  const server = new ApolloServer<RequestContext>({
    schema,
    plugins: [apolloLoggingPlugin(log), ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware<RequestContext>(server, {
      context: async ({ req }: { req: ContextRequest }) => {
        const context = apolloContext(req);
        await onContext?.(context, req);
        return context;
      },
    })
  );

  const url = `http://${resolvedHost}:${port}/graphql`;
  log.info("service ready", { url });

  return { server, url, log };
}
