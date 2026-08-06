export const orderFields = `#graphql
  id
  orderNumber
  customerId
  orderState
  createdAt
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
