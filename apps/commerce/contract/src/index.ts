/**
 * Public entry point of the platform-neutral commerce contract.
 *
 * Exports the two things an adapter needs to stay swap-compatible: the GraphQL
 * type defs (whole schema + per-domain slices) that the adapter's subgraph
 * serves, and the TypeScript types — including the `CommerceProvider` port —
 * that the adapter maps its native backend into. Import from `@csa/commerce-contract`;
 * never reach into a specific platform's package.
 */
export { commerceTypeDefs } from "./schema.js";
export { cartTypeDefs } from "./graphql/cart.graphql.js";
export { companyTypeDefs } from "./graphql/company.graphql.js";
export { customerTypeDefs } from "./graphql/customer.graphql.js";
export { orderTypeDefs } from "./graphql/order.graphql.js";
export { productTypeDefs } from "./graphql/product.graphql.js";
export { quoteTypeDefs } from "./graphql/quote.graphql.js";
export { sharedTypeDefs } from "./graphql/shared.graphql.js";
export type {
  Cart,
  Company,
  CompanyAddress,
  CompanyAssociate,
  CommerceLineItem,
  CommerceProvider,
  Customer,
  Money,
  Order,
  OrderAddress,
  OrderReturnInfo,
  OrderReturnItem,
  Page,
  Product,
  Quote
} from "./types.js";
