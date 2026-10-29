export const cartFields = `#graphql
  id
  version
  key
  customerId
  customerEmail
  createdAt
  lastModifiedAt
  cartState
  shippingAddress {
    streetNumber
    streetName
    apartment
    building
    pOBox
    city
    state
    postalCode
    country
    phone
    mobile
    additionalStreetInfo
    additionalAddressInfo
  }
  billingAddress {
    streetNumber
    streetName
    apartment
    building
    pOBox
    city
    state
    postalCode
    country
    phone
    mobile
    additionalStreetInfo
    additionalAddressInfo
  }
  totalPrice {
    centAmount
    currencyCode
    fractionDigits
  }
  shippingInfo {
    shippingMethod { id name }
    price { centAmount currencyCode fractionDigits }
  }
  discountCodes {
    discountCode { id code }
    state
  }
  discountOnTotalPrice {
    discountedAmount { centAmount currencyCode fractionDigits }
  }
  lineItems {
    id
    productId
    variant {
      sku
    }
    nameAllLocales {
      value
    }
    quantity
    price {
      value { centAmount currencyCode fractionDigits }
    }
    totalPrice {
      centAmount
      currencyCode
      fractionDigits
    }
  }
`;
