import type { Order } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapOrder } from "../../mappers.js";
import type { CtOrder } from "../../types.js";

const query = `#graphql
  query OrderById($id: String!) {
    order(id: $id) {
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

export async function getOrderById(id: string): Promise<Order | null> {
  const data = await commercetoolsGraphql<{ order: CtOrder | null }>(query, {
    id
  });

  return mapOrder(data.order);
}

