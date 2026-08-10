import { gql } from "graphql-tag";

export const orderTypeDefs = gql`
  type Order @key(fields: "id") {
    id: ID!
    orderNumber: String
    customerId: String
    customerEmail: String
    state: String
    orderState: String
    shipmentState: String
    paymentState: String
    createdAt: String
    lastModifiedAt: String
    totalPrice: Money
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

  type OrderPage {
    results: [Order!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  extend type Query {
    order(id: ID, orderNumber: String): Order
    orders(limit: Int = 20, offset: Int = 0): [Order!]!
    orderPage(limit: Int = 20, offset: Int = 0, customerId: ID, customerEmail: String, orderRef: String, sortKey: String, sortOrder: String): OrderPage!
    searchOrders(option: String = "all", text: String!, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): SearchIdsResult!
    b2bOrders(limit: Int = 20, offset: Int = 0, businessUnitKey: String, customerId: ID, sortKey: String, sortOrder: String): OrderPage!
    orderPayments(id: ID!): Json
    orderReturns(id: ID!): Json
    orderCount(customerId: ID!, states: [String!]): Int!
  }

  extend type Mutation {
    updateOrder(id: ID!, actions: Json!): Json!
    replicateOrder(id: ID!): Json!
  }
`;
