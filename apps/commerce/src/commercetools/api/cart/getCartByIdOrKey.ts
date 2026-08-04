import type { Cart } from "../../../domain/types.js";
import { commercetoolsGraphql } from "../../client.js";
import { mapCart } from "../../mappers.js";
import type { CtCart } from "../../types.js";

const query = `#graphql
  query CartByIdOrKey($id: String, $key: String) {
    cart(id: $id, key: $key) {
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
`;

export async function getCartByIdOrKey(args: {
  id?: string;
  key?: string;
}): Promise<Cart | null> {
  const data = await commercetoolsGraphql<{ cart: CtCart | null }>(query, args);

  return mapCart(data.cart);
}

