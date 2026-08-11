import { gql } from "@apollo/client";

export const CART_FIELDS = gql`
  fragment CartFields on Cart {
    id
    version
    key
    customerId
    currencyCode
    totalPrice { centAmount currencyCode fractionDigits }
    lineItems {
      id productId sku name quantity
      totalPrice { centAmount currencyCode fractionDigits }
    }
  }
`;

export const CARTS_QUERY = gql`
  ${CART_FIELDS}
  query CartsPage($limit: Int!, $offset: Int!) {
    cartPage(limit: $limit, offset: $offset, sortKey: "lastModifiedAt", sortOrder: "desc") {
      total count offset results { ...CartFields }
    }
  }
`;

export const CART_CUSTOMERS_QUERY = gql`
  query CartCustomers($limit: Int!, $offset: Int!) {
    customerPage(limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
      results { id firstName lastName companyName email }
    }
  }
`;
