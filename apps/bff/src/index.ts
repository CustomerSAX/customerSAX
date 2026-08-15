import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import "./server/env.js";
import { apolloContext, apolloLoggingPlugin, createLogger } from "@csa/logger";
import { buildGateway, type GatewayContext } from "./server/federation.js";
import { localSchema } from "./server/local-schema.js";

const log = createLogger("bff");
const gateway = buildGateway(log);
const server = gateway
  ? new ApolloServer({ gateway, plugins: [apolloLoggingPlugin(log)] })
  : new ApolloServer({ ...localSchema, plugins: [apolloLoggingPlugin(log)] });

const port = Number(process.env.BFF_PORT ?? 4000);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

const { url } = await startStandaloneServer(server, {
  listen: { host, port },
  context: async ({ req }): Promise<GatewayContext> => apolloContext(req)
});

log.info("service ready", { url });
