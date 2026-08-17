import { gql } from "graphql-tag";

export const quoteTypeDefs = gql`
  type Quote {
    id: ID!
    key: String
    quoteNumber: String
    companyKey: String
    companyName: String
    customerId: ID
    customerEmail: String
    status: String
    totalPrice: Money
    createdAt: String
    lastModifiedAt: String
  }

  type QuotePage {
    results: [Quote!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  extend type Query {
    quotes(companyKey: String, customerId: ID, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): QuotePage!
  }
`;
