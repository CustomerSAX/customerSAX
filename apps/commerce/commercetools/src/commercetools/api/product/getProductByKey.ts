import type { Product } from "@csa/commerce-contract";
import { commercetoolsGraphql, commercetoolsLookup } from "../../client.js";
import { mapProduct } from "../../mappers.js";
import type { CtProduct } from "../../types.js";
import { productFields } from "./productFields.js";

const query = `#graphql
  query ProductByKey($key: String!) {
    product(key: $key) {
      ${productFields}
    }
  }
`;

export async function getProductByKey(key: string): Promise<Product | null> {
  return commercetoolsLookup(async () => {
    const data = await commercetoolsGraphql<{ product: CtProduct | null }>(query, { key });

    return mapProduct(data.product);
  }, `getProductByKey(${key})`);
}
