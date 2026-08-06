import type { Product } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapProduct } from "../../mappers.js";
import type { CtProduct } from "../../types.js";
import { productFields } from "./productFields.js";

const query = `#graphql
  query ProductById($id: String!) {
    product(id: $id) {
      ${productFields}
    }
  }
`;

export async function getProductById(id: string): Promise<Product | null> {
  const data = await commercetoolsGraphql<{ product: CtProduct | null }>(query, { id });

  return mapProduct(data.product);
}
