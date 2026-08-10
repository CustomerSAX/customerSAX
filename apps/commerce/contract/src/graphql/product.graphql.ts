import { gql } from "graphql-tag";

export const productTypeDefs = gql`
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

  type ProductPage {
    results: [Product!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  extend type Query {
    product(id: ID, key: String): Product
    products(limit: Int = 20, offset: Int = 0): [Product!]!
    productPage(limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): ProductPage!
    productSearch(
      field: String
      text: String
      browse: Boolean = false
      locale: String = "en"
      currency: String = "USD"
      limit: Int = 20
      offset: Int = 0
      sortKey: String
      sortOrder: String
    ): Json!
    productDetail(id: ID!): Json
    productBySlug(slug: String!, locale: String = "en"): Product
    quickSearchProducts(q: String!, limit: Int = 10): [Product!]!
    standalonePrices(sku: String!): Json!
  }
`;

