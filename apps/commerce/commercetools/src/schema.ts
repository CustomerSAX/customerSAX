import { commerceTypeDefs } from "@csa/commerce-contract";
import { createCommercetoolsProvider } from "./commercetools/index.js";

const provider = createCommercetoolsProvider();

export const typeDefs = commerceTypeDefs;

export const resolvers = {
  Query: {
    cart: (_parent: unknown, args: { id?: string; key?: string }) => provider.getCart(args),
    carts: (_parent: unknown, args: { limit?: number; offset?: number }) =>
      provider.listCarts(args),
    commerceProvider: () => provider.name,
    customer: (_parent: unknown, args: { email?: string; id?: string }) =>
      provider.getCustomer(args),
    customers: (_parent: unknown, args: { limit?: number; offset?: number }) =>
      provider.listCustomers(args),
    order: (_parent: unknown, args: { id?: string; orderNumber?: string }) =>
      provider.getOrder(args),
    orders: (_parent: unknown, args: { limit?: number; offset?: number }) =>
      provider.listOrders(args),
    product: (_parent: unknown, args: { id?: string; key?: string }) =>
      provider.getProduct(args),
    products: (_parent: unknown, args: { limit?: number; offset?: number }) =>
      provider.listProducts(args)
  }
};

