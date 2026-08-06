import type { Order } from "../../../commerce/types.js";
import { commercetoolsGraphql } from "../../client.js";
import { mapOrder } from "../../mappers.js";
import type { CtOrder } from "../../types.js";
import { orderFields } from "./orderFields.js";

const query = `#graphql
  query OrderById($id: String!) {
    order(id: $id) {
      ${orderFields}
    }
  }
`;

export async function getOrderById(id: string): Promise<Order | null> {
  const data = await commercetoolsGraphql<{ order: CtOrder | null }>(query, {
    id
  });

  return mapOrder(data.order);
}
