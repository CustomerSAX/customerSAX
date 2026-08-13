import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import "./server/load-env.js";
import { buildGateway, type GatewayContext } from "./server/federation.js";
import { localSchema } from "./server/local-schema.js";

const gateway = buildGateway();
const server = gateway
  ? new ApolloServer({ gateway })
  : new ApolloServer(localSchema);

const port = Number(process.env.BFF_PORT ?? 4000);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

const { url } = await startStandaloneServer(server, {
  listen: { host, port },
  context: async ({ req }): Promise<GatewayContext> => ({
    projectKey: headerValue(req.headers["x-csa-project-key"]),
    clientId: headerValue(req.headers["x-csa-client-id"]),
    userRole: headerValue(req.headers["x-csa-user-role"]),
    userEmail: headerValue(req.headers["x-csa-user-email"])
  })
});

console.log(`CSA GraphQL BFF ready at ${url}`);

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
