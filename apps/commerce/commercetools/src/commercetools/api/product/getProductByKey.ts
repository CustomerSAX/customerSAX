import type { Product } from "../../../commerce/types.js";
import { commercetoolsGraphql } from "../../client.js";
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
  const data = await commercetoolsGraphql<{ product: CtProduct | null }>(query, { key });

  return mapProduct(data.product);
}
