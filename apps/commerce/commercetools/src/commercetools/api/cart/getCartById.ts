import type { Cart } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapCart } from "../../mappers.js";
import type { CtCart } from "../../types.js";
import { cartFields } from "./cartFields.js";

const query = `#graphql
  query CartById($id: String!) {
    cart(id: $id) {
      ${cartFields}
    }
  }
`;

export async function getCartById(id: string): Promise<Cart | null> {
  const data = await commercetoolsGraphql<{ cart: CtCart | null }>(query, { id });

  return mapCart(data.cart);
}
