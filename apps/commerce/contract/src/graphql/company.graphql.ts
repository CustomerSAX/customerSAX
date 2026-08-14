import { gql } from "graphql-tag";

export const companyTypeDefs = gql`
  type Company @key(fields: "id") {
    id: ID!
    key: String!
    name: String!
    status: String
    unitType: String
    parentUnit: CompanyReference
    contactEmail: String
    associateMode: String
    storeMode: String
    approvalRuleMode: String
    createdAt: String
    lastModifiedAt: String
    addresses: [CompanyAddress!]!
    associates: [CompanyAssociate!]!
  }

  type CompanyReference {
    id: ID
    key: String
    name: String
  }

  type CompanyAddress {
    id: ID
    key: String
    streetName: String
    streetNumber: String
    city: String
    state: String
    postalCode: String
    country: String
    company: String
    email: String
    phone: String
    firstName: String
    lastName: String
  }

  type CompanyAssociate {
    id: ID
    customerId: ID
    email: String
    firstName: String
    lastName: String
    roles: [String!]!
  }

  type CompanyPage {
    results: [Company!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  extend type Query {
    company(id: ID, key: String): Company
    companies(limit: Int = 20, offset: Int = 0, searchField: String, searchText: String, sortKey: String, sortOrder: String): CompanyPage!
    companyCarts(companyKey: String!, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): CartPage!
    companyOrders(companyKey: String!, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): OrderPage!
  }
`;
