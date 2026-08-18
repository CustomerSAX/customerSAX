/**
 * The platform-neutral CSA commerce GraphQL schema — the single contract every
 * commerce adapter subgraph implements (commercetools today; shopify,
 * bigcommerce, sfcc as stubs). Adapters map their native backend onto THESE
 * types, and the BFF composes exactly one adapter, so consumers depend on this
 * schema and never on any specific platform.
 *
 * These type defs are the source of truth: this package is compiled to `dist/`
 * and every subgraph imports the built output, so a schema edit here is only
 * live after `pnpm --filter @csa/commerce-contract build` (predev/prebuild run
 * it once at startup — an edit while a subgraph's watcher is already running
 * serves the stale schema until you rebuild). Split per domain purely for
 * readability; the order here is the composition order.
 */
import { agentTypeDefs } from "./graphql/agent.graphql.js";
import { cartTypeDefs } from "./graphql/cart.graphql.js";
import { companyTypeDefs } from "./graphql/company.graphql.js";
import { customerTypeDefs } from "./graphql/customer.graphql.js";
import { orderTypeDefs } from "./graphql/order.graphql.js";
import { productTypeDefs } from "./graphql/product.graphql.js";
import { quoteTypeDefs } from "./graphql/quote.graphql.js";
import { sharedTypeDefs } from "./graphql/shared.graphql.js";

export const commerceTypeDefs = [
  sharedTypeDefs,
  agentTypeDefs,
  companyTypeDefs,
  cartTypeDefs,
  customerTypeDefs,
  orderTypeDefs,
  productTypeDefs,
  quoteTypeDefs
];
