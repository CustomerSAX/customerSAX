import { gql } from "graphql-tag";

export const typeDefs = gql`
  type Customer @key(fields: "id") {
    id: ID!
    customerNumber: String
    email: String!
    firstName: String
    lastName: String
  }

  type CustomerPage {
    results: [Customer!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  extend type Query {
    customer(id: ID, email: String): Customer
    customers(limit: Int = 20, offset: Int = 0): [Customer!]!
    customerPage(limit: Int = 20, offset: Int = 0, groupId: ID, excludeGroupId: ID, sortKey: String, sortOrder: String): CustomerPage!
    searchCustomers(option: String = "allFields", text: String, groupId: ID, excludeGroupId: ID, filters: Json, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): CustomerPage!
    customersByEmails(emails: [String!]!): [Customer!]!
    b2bCustomers(limit: Int = 20, offset: Int = 0, searchField: String, searchText: String, sortKey: String, sortOrder: String): CustomerPage!
    customerAddresses(id: ID!): Json!
    customerShoppingLists(id: ID!, wishlist: Boolean = false, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): Json!
    customerPromotions(id: ID!): Json!
  }

  extend type Mutation {
    createCustomer(draft: Json!): Customer
    updateCustomer(id: ID!, draft: Json!): Customer
    updateCustomerProfile(id: ID!, draft: Json!): Customer
    addCustomerAddress(id: ID!, address: Json!, addressType: String): Json!
    updateCustomerAddress(id: ID!, addressId: ID!, address: Json!): Json!
    removeCustomerAddress(id: ID!, addressId: ID!): Json!
    setDefaultCustomerAddress(id: ID!, addressId: ID!, kind: String!): Json!
  }
`;
