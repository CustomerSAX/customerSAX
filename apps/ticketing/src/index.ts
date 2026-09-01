import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";
import { assertTicketStoreConfigured } from "./tickets/repository.js";

const port = Number(process.env.TICKETING_PORT ?? process.env.PORT ?? 4350);

// Fail fast (prod) / warn loudly (dev) if the durable Mongo store is misconfigured,
// before we start accepting ticket writes into an ephemeral in-memory store.
assertTicketStoreConfigured();

await startSubgraph({
  serviceName: "ticketing",
  schema: buildSubgraphSchema([{ resolvers, typeDefs }]),
  port,
});
