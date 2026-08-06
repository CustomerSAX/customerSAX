import type { Order } from "../../../commerce/types.js";
import { commercetoolsGraphql } from "../../client.js";
import { mapOrder } from "../../mappers.js";
import type { CtOrder } from "../../types.js";
import { orderFields } from "./orderFields.js";

const query = `#graphql
  query OrderByNumber($orderNumber: String!) {
    order(orderNumber: $orderNumber) {
      ${orderFields}
    }
  }
`;

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const data = await commercetoolsGraphql<{ order: CtOrder | null }>(query, {
    orderNumber
  });

  return mapOrder(data.order);
}
