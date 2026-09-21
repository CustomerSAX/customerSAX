import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { assertSubscriptionStoreConfigured } from "./subscriptions/repository.js";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.PORT ?? process.env.SUBSCRIPTIONS_PORT ?? 4380);

assertSubscriptionStoreConfigured();

await startSubgraph({
  serviceName: "subscriptions",
  schema: buildSubgraphSchema([{ resolvers, typeDefs }]),
  port
});
