import { buildSubgraphSchema } from "@apollo/subgraph";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.SHOPIFY_PORT ?? process.env.PORT ?? 4320);

await startSubgraph({
  serviceName: "shopify",
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
  port,
});
