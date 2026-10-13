import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.PORT ?? process.env.CRM_PORT ?? 4390);

// Project CRM credentials are resolved per request, not from startup env.

await startSubgraph({
  serviceName: "crm",
  schema: buildSubgraphSchema([{ resolvers, typeDefs }]),
  port,
});
