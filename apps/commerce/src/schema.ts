import { gql } from "graphql-tag";
import { getCommerceProvider } from "./commerce-provider.js";

type CommerceContext = {
  commercePlatform?: string;
};

export const typeDefs = gql`
  type Product @key(fields: "id") {
    id: ID!
    key: String
    sku: String
    name: String!
    description: String
    slug: String
    imageUrl: String
    price: Money
  }

  type Cart @key(fields: "id") {
    id: ID!
    key: String
    customerId: String
    currencyCode: String!
    totalPrice: Money!
    lineItems: [CartLineItem!]!
  }

  type CartLineItem {
    id: ID!
    productId: String
    sku: String
    name: String!
    quantity: Int!
    totalPrice: Money!
  }

  type Order @key(fields: "id") {
    id: ID!
    orderNumber: String
    customerId: String
    state: String
    createdAt: String
    totalPrice: Money!
    lineItems: [OrderLineItem!]!
  }

  type OrderLineItem {
    id: ID!
    productId: String
    sku: String
    name: String!
    quantity: Int!
    totalPrice: Money!
  }

  type Customer @key(fields: "id") {
    id: ID!
    customerNumber: String
    email: String!
    firstName: String
    lastName: String
  }

  type Money {
    centAmount: Int!
    currencyCode: String!
    fractionDigits: Int!
  }

  type Query {
    commerceProvider: String!
    product(id: ID, key: String): Product
    products(limit: Int = 20, offset: Int = 0): [Product!]!
    cart(id: ID, key: String): Cart
    carts(limit: Int = 20, offset: Int = 0): [Cart!]!
    order(id: ID, orderNumber: String): Order
    orders(limit: Int = 20, offset: Int = 0): [Order!]!
    customer(id: ID, email: String): Customer
    customers(limit: Int = 20, offset: Int = 0): [Customer!]!
  }
`;

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
