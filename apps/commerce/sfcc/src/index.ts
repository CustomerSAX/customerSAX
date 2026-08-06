import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.SFCC_PORT ?? process.env.PORT ?? 4340);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

const server = new ApolloServer({
  schema: buildSubgraphSchema({ resolvers, typeDefs })
});

const { url } = await startStandaloneServer(server, {
  listen: { host, port }
});

console.log(`CSA SFCC adapter ready at ${url}`);

