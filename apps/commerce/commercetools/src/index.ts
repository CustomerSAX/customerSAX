import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import "./load-env.js";
import { resolvers, typeDefs } from "./schema.js";
import { activateProjectContext, type ProjectRequestContext } from "./commercetools/project-context.js";

const port = Number(process.env.COMMERCETOOLS_PORT ?? process.env.PORT ?? 4310);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

const server = new ApolloServer({
  schema: buildSubgraphSchema({ resolvers, typeDefs })
});

const { url } = await startStandaloneServer(server, {
  listen: { host, port },
  context: async ({ req }): Promise<ProjectRequestContext> => {
    const context = {
      projectKey: headerValue(req.headers["x-csa-project-key"]),
      clientId: headerValue(req.headers["x-csa-client-id"])
    };
    activateProjectContext(context);
    return context;
  }
});

console.log(`CSA commercetools adapter ready at ${url}`);

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
