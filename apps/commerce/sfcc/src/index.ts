import { buildSubgraphSchema } from "@apollo/subgraph";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.SFCC_PORT ?? process.env.PORT ?? 4340);

await startSubgraph({
  serviceName: "sfcc",
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
  port,
});
