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
`;
