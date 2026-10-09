import { gql } from "@apollo/client";

/**
 * GraphQL queries for sales orders in RepMotion Studio,
 * adhering to the schema and conventions established in Customer CX Studio.
 */
export const SALES_CUSTOMER_ORDERS_QUERY = gql`
  query SalesCustomerOrders($customerId: ID, $customerEmail: String, $limit: Int, $offset: Int) {
    orderPage(
      customerId: $customerId
      customerEmail: $customerEmail
      limit: $limit
      offset: $offset
      sortKey: "createdAt"
      sortOrder: "desc"
    ) {
      total
      count
      offset
      results {
        id
        orderNumber
        customerId
        customerEmail
        orderState
        shipmentState
        paymentState
        createdAt
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        lineItems {
          id
          name
          quantity
          totalPrice {
            centAmount
            currencyCode
            fractionDigits
          }
        }
        shippingAddress {
          streetName
          streetNumber
          city
          state
          postalCode
          country
        }
        billingAddress {
          streetName
          streetNumber
          city
          state
          postalCode
          country
        }
      }
    }
  }
`;
