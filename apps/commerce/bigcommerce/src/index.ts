import { buildSubgraphSchema } from "@apollo/subgraph";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";

const port = Number(process.env.BIGCOMMERCE_PORT ?? process.env.PORT ?? 4330);
const schemaModules = typeDefs.map((moduleTypeDefs, index) => ({
  typeDefs: moduleTypeDefs,
  ...(index === 0 ? { resolvers } : {}),
}));

await startSubgraph({
  serviceName: "bigcommerce",
  schema: buildSubgraphSchema(schemaModules),
  port,
});
