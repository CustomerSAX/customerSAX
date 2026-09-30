import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";
import { assertTicketStoreConfigured } from "./tickets/repository.js";

import { ticketingProviderName } from "./providers/index.js";

const port = Number(process.env.PORT ?? process.env.TICKETING_PORT ?? 4350);

// Fail fast (prod) / warn loudly (dev) if the durable Mongo store is misconfigured,
// before we start accepting ticket writes into an ephemeral in-memory store.
if (ticketingProviderName() === "internal") assertTicketStoreConfigured();
// Project Zendesk credentials are resolved per request, not from startup env.

await startSubgraph({
  serviceName: "ticketing",
  schema: buildSubgraphSchema([{ resolvers, typeDefs }]),
  port,
});
