import type { Product } from "../../../commerce/types.js";
import { getProductById } from "./getProductById.js";
import { getProductByKey } from "./getProductByKey.js";

export async function getProductByIdOrKey(args: {
  id?: string;
  key?: string;
}): Promise<Product | null> {
  if (args.id) {
    return getProductById(args.id);
  }

  if (args.key) {
    return getProductByKey(args.key);
  }

  return null;
}
