import type { Cart } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapCart } from "../../mappers.js";
import type { CtCart } from "../../types.js";
import { cartFields } from "./cartFields.js";

const query = `#graphql
  query Carts($limit: Int!, $offset: Int!) {
    carts(limit: $limit, offset: $offset) {
      results {
        ${cartFields}
      }
    }
  }
`;

export async function listCarts(args: { limit?: number; offset?: number }): Promise<Cart[]> {
  const data = await commercetoolsGraphql<{ carts: { results: CtCart[] } }>(
    query,
    paging(args)
  );

  return data.carts.results.map(mapCart).filter(isDefined);
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
