import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { apolloContext, apolloLoggingPlugin, createLogger } from "@csa/logger";
import { resolvers, typeDefs } from "./schema.js";

const log = createLogger("ticketing");
const port = Number(process.env.TICKETING_PORT ?? process.env.PORT ?? 4350);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

const server = new ApolloServer({
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
  plugins: [apolloLoggingPlugin(log)]
});

const { url } = await startStandaloneServer(server, {
  listen: { host, port },
  context: async ({ req }) => apolloContext(req)
});

log.info("service ready", { url });
