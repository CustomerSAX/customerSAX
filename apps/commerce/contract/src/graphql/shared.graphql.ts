import { gql } from "graphql-tag";

export const sharedTypeDefs = gql`
  scalar Json

  type Money {
    centAmount: Int!
    currencyCode: String!
    fractionDigits: Int!
  }

  type SearchIdsResult {
    ids: [ID!]!
    total: Int!
  }

  type Query {
    commerceProvider: String!
  }

  type Mutation {
    _empty: String
  }
`;
