import type { Order } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapOrder } from "../../mappers.js";
import type { CtOrder } from "../../types.js";

const query = `#graphql
  query OrderByNumber($orderNumber: String!) {
    order(orderNumber: $orderNumber) {
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
    }
  }
`;

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const data = await commercetoolsGraphql<{ order: CtOrder | null }>(query, {
    orderNumber
  });

  return mapOrder(data.order);
}

