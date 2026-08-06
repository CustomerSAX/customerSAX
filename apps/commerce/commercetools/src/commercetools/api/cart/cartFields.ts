export const cartFields = `#graphql
  id
  version
  key
  customerId
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
