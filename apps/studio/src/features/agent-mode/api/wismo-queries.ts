import { gql } from "@apollo/client";

export const GET_ORDER_FOR_WISMO = gql`
  query GetOrderForWismo($orderNumber: String) {
    order(orderNumber: $orderNumber) {
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
        }
      }
    }
  }
`;
