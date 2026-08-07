import type { Cart, Page } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapCart } from "../../mappers.js";
import type { CtCart } from "../../types.js";
import { cartFields } from "./cartFields.js";

const query = `#graphql
  query Carts($limit: Int!, $offset: Int!) {
    carts(limit: $limit, offset: $offset) {
      total
      count
      offset
      results {
        ${cartFields}
      }
    }
  }
`;

export async function listCarts(args: { limit?: number; offset?: number }): Promise<Page<Cart>> {
  const data = await commercetoolsGraphql<{
    carts: { count?: number; offset?: number; results: CtCart[]; total?: number };
  }>(
    query,
    paging(args)
  );

  const results = data.carts.results.map(mapCart).filter(isDefined);

  return {
    count: data.carts.count ?? results.length,
    offset: data.carts.offset ?? args.offset ?? 0,
    results,
    total: data.carts.total ?? results.length
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
