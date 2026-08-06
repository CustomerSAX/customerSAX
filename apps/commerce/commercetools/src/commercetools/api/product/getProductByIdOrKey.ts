import type { Product } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapProduct } from "../../mappers.js";
import type { CtProduct } from "../../types.js";

const query = `#graphql
  query ProductByIdOrKey($id: String, $key: String) {
    product(id: $id, key: $key) {
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
`;

export async function getProductByIdOrKey(args: {
  id?: string;
  key?: string;
}): Promise<Product | null> {
  const data = await commercetoolsGraphql<{ product: CtProduct | null }>(query, args);

  return mapProduct(data.product);
}

