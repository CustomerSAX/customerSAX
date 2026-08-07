import type { Order, Page } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapOrder } from "../../mappers.js";
import type { CtOrder } from "../../types.js";
import { orderFields } from "./orderFields.js";

const query = `#graphql
  query Orders($limit: Int!, $offset: Int!) {
    orders(limit: $limit, offset: $offset) {
      total
      count
      offset
      results {
        ${orderFields}
      }
    }
  }
`;

export async function listOrders(args: { limit?: number; offset?: number }): Promise<Page<Order>> {
  const data = await commercetoolsGraphql<{
    orders: { count?: number; offset?: number; results: CtOrder[]; total?: number };
  }>(
    query,
    paging(args)
  );

  const results = data.orders.results.map(mapOrder).filter(isDefined);

  return {
    count: data.orders.count ?? results.length,
    offset: data.orders.offset ?? args.offset ?? 0,
    results,
    total: data.orders.total ?? results.length
  };
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
