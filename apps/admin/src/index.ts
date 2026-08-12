import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import "./load-env.js";
import { resolvers, typeDefs } from "./schema.js";
import { ensureClientsIndex, ensureProjectsIndex, ensureSmtpProfilesIndex, ensureUsersIndex } from "@csa/mongodb";

const port = Number(process.env.ADMIN_PORT ?? process.env.PORT ?? 4370);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

await Promise.all([ensureClientsIndex(), ensureProjectsIndex(), ensureSmtpProfilesIndex(), ensureUsersIndex()]).catch(
  (error) => {
    console.warn("[admin] index setup warning (non-fatal):", error);
  }
);

const server = new ApolloServer({
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
});

const { url } = await startStandaloneServer(server, {
  listen: { host, port },
});

console.log(`CSA admin (superadmin) service ready at ${url}`);
