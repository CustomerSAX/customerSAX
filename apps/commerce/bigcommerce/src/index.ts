import { buildSubgraphSchema } from "@apollo/subgraph";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.BIGCOMMERCE_PORT ?? process.env.PORT ?? 4330);

await startSubgraph({
  serviceName: "bigcommerce",
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
  port,
});
