import { agentTypeDefs } from "./graphql/agent.graphql.js";
import { cartTypeDefs } from "./graphql/cart.graphql.js";
import { customerTypeDefs } from "./graphql/customer.graphql.js";
import { orderTypeDefs } from "./graphql/order.graphql.js";
import { productTypeDefs } from "./graphql/product.graphql.js";
import { sharedTypeDefs } from "./graphql/shared.graphql.js";

export const commerceTypeDefs = [
  sharedTypeDefs,
  agentTypeDefs,
  cartTypeDefs,
  customerTypeDefs,
  orderTypeDefs,
  productTypeDefs
];
