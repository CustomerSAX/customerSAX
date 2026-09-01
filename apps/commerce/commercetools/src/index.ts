import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";
import { activateProjectContext } from "./commercetools/project-context.js";

const port = Number(process.env.PORT ?? process.env.COMMERCETOOLS_PORT ?? 4310);
const schemaModules = typeDefs.map((moduleTypeDefs, index) => ({
  typeDefs: moduleTypeDefs,
  ...(index === 0 ? { resolvers } : {}),
}));

await startSubgraph({
  serviceName: "commercetools",
  schema: buildSubgraphSchema(schemaModules),
  port,
  onContext: (context) => {
    activateProjectContext(context);
  },
});
