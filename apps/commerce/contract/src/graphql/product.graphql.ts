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

  input ProductCatalogFiltersInput {
    productTypes: [String!]
    categoryIds: [String!]
    availability: [String!]
    minPrice: Float
    maxPrice: Float
  }

  extend type Query {
    availableCurrencies: [String!]!
    "Country codes configured in the project's settings (the countries the store sells to), in project order."
    availableCountries: [String!]!
    product(id: ID, key: String): Product
    products(limit: Int = 20, offset: Int = 0): [Product!]!
    productPage(limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): ProductPage!
    productSearch(
      filters: ProductCatalogFiltersInput
      includeFacets: Boolean = false
      field: String
      text: String
      browse: Boolean = false
      locale: String = "en"
      # No default: when omitted, the commercetools subgraph uses the
      # selected project's own currency (a "USD" default here forced USD
      # price selection for every project, e.g. AUD-priced ones).
      currency: String
      limit: Int = 20
      offset: Int = 0
      sortKey: String
      sortOrder: String
    ): Json!
    productDetail(id: ID!): Json
    productPrices(sku: String!): [Money!]!
    productBySlug(slug: String!, locale: String = "en"): Product
    quickSearchProducts(q: String!, limit: Int = 10): [Product!]!
    standalonePrices(sku: String!): Json!
  }
`;
