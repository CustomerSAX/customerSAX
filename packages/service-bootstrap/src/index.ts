/**
 * `@csa/service-bootstrap` — the shared Apollo-subgraph startup for CSA.
 *
 * Every CSA subgraph (`commercetools`, `ticketing`, `admin`, and the
 * `bigcommerce`/`shopify`/`sfcc` stubs) used to copy-paste the same
 * `ApolloServer` + `startStandaloneServer` boilerplate: the logging plugin, the
 * `K_SERVICE`-aware host, the `@csa/logger`/`@csa/headers` request-context
 * wiring, and the "service ready" startup log. This package owns that once so a
 * subgraph entrypoint only has to build its schema and call `startSubgraph`.
 *
 * Nothing about identity/correlation changes: the per-request context is still
 * built by `@csa/logger`'s `apolloContext` (which reads the CSA identity headers
 * via `@csa/headers`) and bound to the operation by `apolloLoggingPlugin`, so an
 * inbound `x-request-id` and tenant/user identity flow through exactly as before.
 *
 * ## Why no shared `/health` for the Apollo servers
 *
 * Apollo Server v4's `startStandaloneServer` deliberately does NOT expose the
 * underlying HTTP/Express server or allow mounting extra routes — it only
 * returns `{ url }`. Adding a uniform `/health` endpoint (like `@csa/auth`'s raw
 * `node:http` server has) would mean abandoning `startStandaloneServer` for a
 * hand-rolled Express app + `expressMiddleware` in every subgraph, which changes
 * the CORS/body-parsing defaults and the server shape — a behavioral change, not
 * a clean addition. Per the "correctness over forcing it" rule, `/health` is
 * therefore intentionally NOT added to the Apollo subgraphs this pass. A GraphQL
 * `POST { __typename }` remains the liveness probe for these services. If a
 * uniform HTTP `/health` is wanted later, migrate the subgraphs to
 * `expressMiddleware` as a deliberate, separately-verified change.
 */
import type { IncomingMessage } from "node:http";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
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
   * Host to bind. Defaults to the `K_SERVICE`-aware choice used across CSA:
   * `0.0.0.0` on Cloud Run, `127.0.0.1` locally (overridable via `HOST`).
   */
  host?: string;
  /**
   * Optional per-request hook run after the shared `RequestContext` is built and
   * before it is returned as the Apollo `contextValue`. Used by the
   * commercetools subgraph to `activateProjectContext(context)` for tenant
   * routing. The same `context` object that is returned to Apollo is passed in,
   * so mutations/side-effects on it are preserved.
   */
  onContext?: (context: RequestContext, req: ContextRequest) => void | Promise<void>;
}

/** The default host CSA services bind to (Cloud Run vs. local). */
export function resolveHost(): string {
  return process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");
}

/**
 * Boots a CSA Apollo subgraph with the shared plugin/context/logging wiring and
 * emits the structured "service ready" startup line. Returns the started
 * server, its URL, and the service logger.
 */
export async function startSubgraph({ serviceName, schema, port, host, onContext }: StartSubgraphOptions) {
  const log = createLogger(serviceName);
  const resolvedHost = host ?? resolveHost();

  const server = new ApolloServer({
    schema,
    plugins: [apolloLoggingPlugin(log)],
  });

  const { url } = await startStandaloneServer(server, {
    listen: { host: resolvedHost, port },
    context: async ({ req }: { req: ContextRequest }) => {
      const context = apolloContext(req);
      await onContext?.(context, req);
      return context;
    },
  });

  log.info("service ready", { url });

  return { server, url, log };
}
