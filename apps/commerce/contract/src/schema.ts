import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const commerceTypeDefs: DocumentNode = gql`
  scalar Json

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

  type ProductPage {
    results: [Product!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  type CartPage {
    results: [Cart!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  type OrderPage {
    results: [Order!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  type CustomerPage {
    results: [Customer!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  type SearchIdsResult {
    ids: [ID!]!
    total: Int!
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
    productBySlug(slug: String!, locale: String = "en"): Product
    quickSearchProducts(q: String!, limit: Int = 10): [Product!]!
    standalonePrices(sku: String!): Json!

    cartPage(limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): CartPage!
    searchCarts(option: String = "all", text: String!, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): CartPage!
    b2bCarts(limit: Int = 20, offset: Int = 0, businessUnitKey: String, customerId: ID, sortKey: String, sortOrder: String): CartPage!
    activeCartCount(customerId: ID!): Int!

    customerPage(limit: Int = 20, offset: Int = 0, groupId: ID, excludeGroupId: ID, sortKey: String, sortOrder: String): CustomerPage!
    searchCustomers(option: String = "allFields", text: String, groupId: ID, excludeGroupId: ID, filters: Json, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): CustomerPage!
    customersByEmails(emails: [String!]!): [Customer!]!
    b2bCustomers(limit: Int = 20, offset: Int = 0, searchField: String, searchText: String, sortKey: String, sortOrder: String): CustomerPage!
    customerAddresses(id: ID!): Json!
    customerShoppingLists(id: ID!, wishlist: Boolean = false, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): Json!
    customerPromotions(id: ID!): Json!

    orderPage(limit: Int = 20, offset: Int = 0, customerId: ID, customerEmail: String, orderRef: String, sortKey: String, sortOrder: String): OrderPage!
    searchOrders(option: String = "all", text: String!, limit: Int = 20, offset: Int = 0, sortKey: String, sortOrder: String): SearchIdsResult!
    b2bOrders(limit: Int = 20, offset: Int = 0, businessUnitKey: String, customerId: ID, sortKey: String, sortOrder: String): OrderPage!
    orderPayments(id: ID!): Json
    orderReturns(id: ID!): Json
    orderCount(customerId: ID!, states: [String!]): Int!
  }

  type Mutation {
    createB2bCart(currency: String!, businessUnitKey: String, customerId: ID): Cart
    placeOrderFromCart(id: ID!): Json!
    addCartLineItem(id: ID!, sku: String!, quantity: Int!): Cart
    removeCartLineItem(id: ID!, lineItemId: ID!): Cart
    updateCartAddresses(id: ID!, shippingAddress: Json, billingAddress: Json): Cart

    createCustomer(draft: Json!): Customer
    updateCustomer(id: ID!, draft: Json!): Customer
    updateCustomerProfile(id: ID!, draft: Json!): Customer
    addCustomerAddress(id: ID!, address: Json!, addressType: String): Json!
    updateCustomerAddress(id: ID!, addressId: ID!, address: Json!): Json!
    removeCustomerAddress(id: ID!, addressId: ID!): Json!
    setDefaultCustomerAddress(id: ID!, addressId: ID!, kind: String!): Json!

    updateOrder(id: ID!, actions: Json!): Json!
    replicateOrder(id: ID!): Json!
  }
`;
