import { gql } from "graphql-tag";

export const cartTypeDefs = gql`
  type Cart @key(fields: "id") {
    id: ID!
    version: Int!
    key: String
    customerId: String
    customerEmail: String
    createdAt: String
    lastModifiedAt: String
    cartState: String
    currencyCode: String!
    shippingAddress: CartAddress
    billingAddress: CartAddress
    totalPrice: Money!
    shippingInfo: CartShippingInfo
    discountCodes: [String!]!
    lineItems: [CartLineItem!]!
  }

  type CartShippingInfo {
    shippingMethodId: ID
    shippingMethodName: String
    price: Money
  }

  type CartAddress {
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

  type ShippingMethod {
    id: ID!
    key: String
    name: String
  }

  type DiscountCode {
    id: ID!
    key: String
    code: String!
    name: String
    isActive: Boolean!
    validFrom: String
    validUntil: String
  }

  extend type Query {
    cart(id: ID, key: String): Cart
    carts(limit: Int = 20, offset: Int = 0): [Cart!]!
    cartPage(
      limit: Int = 20
      offset: Int = 0
      sortKey: String
      sortOrder: String
    ): CartPage!
    searchCarts(
      option: String = "all"
      text: String!
      limit: Int = 20
      offset: Int = 0
      sortKey: String
      sortOrder: String
    ): CartPage!
    b2bCarts(
      limit: Int = 20
      offset: Int = 0
      businessUnitKey: String
      customerId: ID
      sortKey: String
      sortOrder: String
    ): CartPage!
    activeCartCount(customerId: ID!): Int!
    discountCodes(limit: Int = 100): [DiscountCode!]!
    shippingMethods(limit: Int = 20): [ShippingMethod!]!
  }

  extend type Mutation {
    createB2bCart(
      currency: String!
      businessUnitKey: String
      customerId: ID
      customerEmail: String
    ): Cart
    placeOrderFromCart(id: ID!): Json!
    addCartLineItem(id: ID!, sku: String!, quantity: Int!): Cart
    removeCartLineItem(id: ID!, lineItemId: ID!): Cart
    changeCartLineItemQuantity(id: ID!, lineItemId: ID!, quantity: Int!): Cart
    updateCartAddresses(id: ID!, shippingAddress: Json, billingAddress: Json): Cart
    setCartShippingMethod(id: ID!, shippingMethodId: ID!): Cart
    addCartDiscountCode(id: ID!, code: String!): Cart
  }
`;
