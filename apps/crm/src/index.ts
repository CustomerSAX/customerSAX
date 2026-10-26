import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.PORT ?? process.env.CRM_PORT ?? 4390);

// CRM actions and accounts are resolved from Connection Hub per request.

await startSubgraph({
  serviceName: "crm",
  schema: buildSubgraphSchema([{ resolvers, typeDefs }]),
  port,
});
