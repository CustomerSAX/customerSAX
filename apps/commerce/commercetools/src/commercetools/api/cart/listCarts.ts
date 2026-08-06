import type { Cart } from "../../../commerce/types.js";
import { commercetoolsGraphql } from "../../client.js";
import { mapCart } from "../../mappers.js";
import type { CtCart } from "../../types.js";

const query = `#graphql
  query Carts($limit: Int!, $offset: Int!) {
    carts(limit: $limit, offset: $offset) {
      results {
        id
        key
        customerId
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
