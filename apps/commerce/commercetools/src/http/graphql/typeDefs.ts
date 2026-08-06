import { cart } from "./cart/index.js";
import { customer } from "./customer/index.js";
import { order } from "./order/index.js";
import { product } from "./product/index.js";
import { typeDefs as sharedTypeDefs } from "./shared/shared.graphql.js";

export const typeDefs = [
  sharedTypeDefs,
  ...cart.typeDefs,
  ...customer.typeDefs,
  ...order.typeDefs,
  ...product.typeDefs
];
