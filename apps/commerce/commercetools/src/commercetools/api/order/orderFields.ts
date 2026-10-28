export const orderFields = `#graphql
  id
  orderNumber
  customerId
  customerEmail
  orderState
  shipmentState
  paymentState
  createdAt
  lastModifiedAt
  totalPrice {
    centAmount
    currencyCode
    fractionDigits
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
    totalPrice {
      centAmount
      currencyCode
      fractionDigits
    }
  }
  shippingAddress { streetName streetNumber city state postalCode country }
  billingAddress  { streetName streetNumber city state postalCode country }
  shippingInfo { deliveries { id createdAt parcels { id createdAt trackingData { trackingId carrier provider providerTransaction isReturn } } } }
  shipping { shippingInfo { deliveries { id createdAt parcels { id createdAt trackingData { trackingId carrier provider providerTransaction isReturn } } } } }
  returnInfo {
    returnTrackingId
    returnDate
    items {
      id
      type
      quantity
      shipmentState
      paymentState
      comment
      ... on LineItemReturnItem { lineItemId }
    }
  }
`;
