import type { Cart } from "../../../commerce/types.js";
import { getCartById } from "./getCartById.js";
import { getCartByKey } from "./getCartByKey.js";

export async function getCartByIdOrKey(args: {
  id?: string;
  key?: string;
}): Promise<Cart | null> {
  if (args.id) {
    return getCartById(args.id);
  }

  if (args.key) {
    return getCartByKey(args.key);
  }

  return null;
}
