import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const commerceTypeDefs: DocumentNode = gql`
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
