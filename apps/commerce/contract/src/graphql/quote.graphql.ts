import { gql } from "graphql-tag";

export const quoteTypeDefs = gql`
  type Quote {
    id: ID!
    key: String
    quoteNumber: String
    comment: String
    companyKey: String
    companyName: String
    businessUnit: QuoteBusinessUnit
    customerId: ID
    customerEmail: String
    customer: QuoteCustomer
    lineItemCount: Int
    lineItems: [QuoteLineItem!]!
    status: String
    totalPrice: Money
    shippingAddress: QuoteAddress
    billingAddress: QuoteAddress
    createdAt: String
    lastModifiedAt: String
  }

  type QuoteBusinessUnit {
    key: String
    name: String
  }

  type QuoteCustomer {
    id: ID
    firstName: String
    lastName: String
    email: String
  }

  type QuoteAddress {
    streetNumber: String
    streetName: String
    apartment: String
    building: String
    pOBox: String
    city: String
    state: String
    postalCode: String
    country: String
    phone: String
    mobile: String
    additionalStreetInfo: String
    additionalAddressInfo: String
  }

  type QuoteLineItem {
    id: ID!
    productId: String
    sku: String
    name: String!
    quantity: Int!
    unitPrice: Money
    totalPrice: Money!
  }

  type QuotePage {
    results: [Quote!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  type QuoteRequestResult {
    id: ID!
    version: Int
    quoteRequestState: String
  }

  extend type Query {
    quote(id: ID!): Quote
    quotes(companyKey: String, customerId: ID, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): QuotePage!
  }

  extend type Mutation {
    createQuoteRequest(cartId: ID!, comment: String): QuoteRequestResult!
  }
`;
