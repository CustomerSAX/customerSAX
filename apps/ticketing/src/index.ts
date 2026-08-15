import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.TICKETING_PORT ?? process.env.PORT ?? 4350);

await startSubgraph({
  serviceName: "ticketing",
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
  port,
});
