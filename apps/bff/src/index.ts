import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildGateway } from "./server/federation.js";
import { localSchema } from "./server/local-schema.js";

const gateway = buildGateway();
const server = gateway
  ? new ApolloServer({ gateway })
  : new ApolloServer(localSchema);

const port = Number(process.env.BFF_PORT ?? 4000);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

const { url } = await startStandaloneServer(server, {
  listen: { host, port }
});

console.log(`CSA GraphQL BFF ready at ${url}`);
