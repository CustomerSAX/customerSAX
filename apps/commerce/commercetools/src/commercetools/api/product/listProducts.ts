import type { Product } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapProduct } from "../../mappers.js";
import type { CtProduct } from "../../types.js";
import { productFields } from "./productFields.js";

const query = `#graphql
  query Products($limit: Int!, $offset: Int!) {
    products(limit: $limit, offset: $offset) {
      results {
        ${productFields}
      }
    }
  }
`;

export async function listProducts(args: {
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const data = await commercetoolsGraphql<{ products: { results: CtProduct[] } }>(
    query,
    paging(args)
  );

  return data.products.results.map(mapProduct).filter(isDefined);
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
