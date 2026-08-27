import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";
import { activateProjectContext } from "./commercetools/project-context.js";

const port = Number(process.env.COMMERCETOOLS_PORT ?? process.env.PORT ?? 4310);

await startSubgraph({
  serviceName: "commercetools",
  schema: buildSubgraphSchema({ resolvers, typeDefs }),
  port,
  onContext: (context) => {
    activateProjectContext(context);
  },
});
