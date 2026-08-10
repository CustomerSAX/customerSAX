import { gql } from "@apollo/client";

export const ORDERS_PAGE_QUERY = gql`
  query OrdersPage($limit: Int!, $offset: Int!, $sortKey: String, $sortOrder: String) {
    orderPage(limit: $limit, offset: $offset, sortKey: $sortKey, sortOrder: $sortOrder) {
      total
      count
      offset
      results {
        id
        orderNumber
        customerId
        customerEmail
        state
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
          sku
          name
          quantity
          totalPrice {
            centAmount
            currencyCode
            fractionDigits
          }
        }
      }
    }
  }
`;
