import type { Order } from "../../../commerce/types.js";
import { commercetoolsGraphql } from "../../client.js";
import { mapOrder } from "../../mappers.js";
import type { CtOrder } from "../../types.js";
import { orderFields } from "./orderFields.js";

const query = `#graphql
  query Orders($limit: Int!, $offset: Int!) {
    orders(limit: $limit, offset: $offset) {
      results {
        ${orderFields}
      }
    }
  }
`;

export async function listOrders(args: { limit?: number; offset?: number }): Promise<Order[]> {
  const data = await commercetoolsGraphql<{ orders: { results: CtOrder[] } }>(
    query,
    paging(args)
  );

  return data.orders.results.map(mapOrder).filter(isDefined);
}

function paging(args: { limit?: number; offset?: number }) {
  return {
    limit: args.limit ?? 20,
    offset: args.offset ?? 0
  };
}

function isDefined<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}
