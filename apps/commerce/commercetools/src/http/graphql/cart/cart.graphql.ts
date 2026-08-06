import { gql } from "graphql-tag";

export const typeDefs = gql`
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

  type CartPage {
    results: [Cart!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  extend type Query {
    cart(id: ID, key: String): Cart
    carts(limit: Int = 20, offset: Int = 0): [Cart!]!
    cartPage(limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): CartPage!
    searchCarts(option: String = "all", text: String!, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): CartPage!
    b2bCarts(limit: Int = 20, offset: Int = 0, businessUnitKey: String, customerId: ID, sortKey: String, sortOrder: String): CartPage!
    activeCartCount(customerId: ID!): Int!
  }

  extend type Mutation {
    createB2bCart(currency: String!, businessUnitKey: String, customerId: ID): Cart
    placeOrderFromCart(id: ID!): Json!
    addCartLineItem(id: ID!, sku: String!, quantity: Int!): Cart
    removeCartLineItem(id: ID!, lineItemId: ID!): Cart
    updateCartAddresses(id: ID!, shippingAddress: Json, billingAddress: Json): Cart
  }
`;
