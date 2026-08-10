import type { Cart } from "@csa/commerce-contract";
import { commercetoolsGraphql, commercetoolsLookup } from "../../client.js";
import { mapCart } from "../../mappers.js";
import type { CtCart } from "../../types.js";
import { cartFields } from "./cartFields.js";

const query = `#graphql
  query CartByKey($key: String!) {
    cart(key: $key) {
      ${cartFields}
    }
  }
`;

export async function getCartByKey(key: string): Promise<Cart | null> {
  return commercetoolsLookup(async () => {
    const data = await commercetoolsGraphql<{ cart: CtCart | null }>(query, { key });

    return mapCart(data.cart);
  }, `getCartByKey(${key})`);
}
