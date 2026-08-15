import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { apolloContext, apolloLoggingPlugin, createLogger } from "@csa/logger";
import { resolvers, typeDefs } from "./schema.js";
import { activateProjectContext } from "./commercetools/project-context.js";

const log = createLogger("commercetools");
const port = Number(process.env.COMMERCETOOLS_PORT ?? process.env.PORT ?? 4310);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

const server = new ApolloServer({
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
  plugins: [apolloLoggingPlugin(log)]
});

const { url } = await startStandaloneServer(server, {
  listen: { host, port },
  context: async ({ req }) => {
    const context = apolloContext(req);
    activateProjectContext(context);
    return context;
  }
});

log.info("service ready", { url });
