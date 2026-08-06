import { commerceTypeDefs } from "@csa/commerce-contract";
import { getCommerceProvider } from "./commerce-provider.js";

type CommerceContext = {
  commercePlatform?: string;
};

export const typeDefs = commerceTypeDefs;

export const resolvers = {
  Query: {
    cart: (_parent: unknown, args: { id?: string; key?: string }, context: unknown) =>
      providerFor(context).getCart(args),
    carts: (_parent: unknown, args: { limit?: number; offset?: number }, context: unknown) =>
      providerFor(context).listCarts(args),
    commerceProvider: (_parent: unknown, _args: unknown, context: unknown) =>
      providerFor(context).name,
    customer: (_parent: unknown, args: { email?: string; id?: string }, context: unknown) =>
      providerFor(context).getCustomer(args),
    customers: (_parent: unknown, args: { limit?: number; offset?: number }, context: unknown) =>
      providerFor(context).listCustomers(args),
    order: (_parent: unknown, args: { id?: string; orderNumber?: string }, context: unknown) =>
      providerFor(context).getOrder(args),
    orders: (_parent: unknown, args: { limit?: number; offset?: number }, context: unknown) =>
      providerFor(context).listOrders(args),
    product: (_parent: unknown, args: { id?: string; key?: string }, context: unknown) =>
      providerFor(context).getProduct(args),
    products: (_parent: unknown, args: { limit?: number; offset?: number }, context: unknown) =>
      providerFor(context).listProducts(args)
  }
};

function providerFor(context: unknown) {
  return getCommerceProvider((context as CommerceContext | undefined)?.commercePlatform);
}

