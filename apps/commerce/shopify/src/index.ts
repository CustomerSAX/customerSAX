import { buildSubgraphSchema } from "@apollo/subgraph";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.PORT ?? process.env.SHOPIFY_PORT ?? 4320);
const schemaModules = typeDefs.map((moduleTypeDefs, index) => ({
  typeDefs: moduleTypeDefs,
  ...(index === 0 ? { resolvers } : {}),
}));

await startSubgraph({
  serviceName: "shopify",
  schema: buildSubgraphSchema(schemaModules),
  port,
});
