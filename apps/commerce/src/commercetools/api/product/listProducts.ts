import type { Product } from "../../../domain/types.js";
import { commercetoolsGraphql } from "../../client.js";
import { mapProduct } from "../../mappers.js";
import type { CtProduct } from "../../types.js";

const query = `#graphql
  query Products($limit: Int!, $offset: Int!) {
    products(limit: $limit, offset: $offset) {
      results {
        id
        key
        masterData {
          current {
            nameAllLocales {
              value
            }
            descriptionAllLocales {
              value
            }
            slugAllLocales {
              value
            }
            masterVariant {
              sku
              images {
                url
              }
              prices {
                value {
                  centAmount
                  currencyCode
                  fractionDigits
                }
              }
            }
          }
        }
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

