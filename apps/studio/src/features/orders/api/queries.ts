import { gql } from "@apollo/client";

/**
 * Fetch all orders for a specific customer by their commercetools customerId.
 * Used by CustomerDetailView to replace hardcoded mock order data.
 */
export const CUSTOMER_ORDERS_QUERY = gql`
  query CustomerOrders($customerId: ID!, $limit: Int, $offset: Int) {
    orderPage(customerId: $customerId, limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
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
        returnInfo {
          returnTrackingId
          returnDate
          items {
            id
            type
            quantity
            lineItemId
            shipmentState
            paymentState
            comment
          }
        }
      }
    }
  }
`;

/**
 * Fetch all active carts for a customer. Used by CustomerDetailView.
 */
export const CUSTOMER_CARTS_QUERY = gql`
  query CustomerCarts($customerId: ID!, $limit: Int) {
    b2bCarts(customerId: $customerId, limit: $limit, sortKey: "lastModifiedAt", sortOrder: "desc") {
      total
      count
      results {
        id
        key
        currencyCode
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        lineItems {
          id
          name
          quantity
        }
      }
    }
  }
`;

/**
 * Fetch addresses for a customer (with default shipping/billing IDs).
 * Returns Json (raw), so cast on the consumer side.
 */
export const CUSTOMER_ADDRESSES_QUERY = gql`
  query CustomerAddresses($id: ID!) {
    customerAddresses(id: $id)
  }
`;

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
