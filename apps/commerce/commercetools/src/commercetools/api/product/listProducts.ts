import type { Page, Product } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapProduct } from "../../mappers.js";
import type { CtProduct } from "../../types.js";
import { productFields } from "./productFields.js";

const query = `#graphql
  query Products($limit: Int!, $offset: Int!) {
    products(limit: $limit, offset: $offset) {
      total
      count
      offset
      results {
        ${productFields}
      }
    }
  }
`;

export async function listProducts(args: {
  limit?: number;
  offset?: number;
}): Promise<Page<Product>> {
  const data = await commercetoolsGraphql<{
    products: { count?: number; offset?: number; results: CtProduct[]; total?: number };
  }>(
    query,
    paging(args)
  );

  const results = data.products.results.map(mapProduct).filter(isDefined);

  return {
    count: data.products.count ?? results.length,
    offset: data.products.offset ?? args.offset ?? 0,
    results,
    total: data.products.total ?? results.length
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
