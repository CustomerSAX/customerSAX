import type { CommerceProvider } from "../commerce/types.js";
import {
  getCartByIdOrKey,
  getCustomerByEmail,
  getCustomerById,
  getOrderById,
  getOrderByNumber,
  getProductByIdOrKey,
  listCarts,
  listCustomers,
  listOrders,
  listProducts
} from "./api/index.js";

export function createCommercetoolsProvider(): CommerceProvider {
  return {
    getCart: (args) => getCartByIdOrKey(args),
    getCustomer: async (args) =>
      args.email ? getCustomerByEmail(args.email) : args.id ? getCustomerById(args.id) : null,
    getOrder: async (args) =>
      args.orderNumber ? getOrderByNumber(args.orderNumber) : args.id ? getOrderById(args.id) : null,
    getProduct: (args) => getProductByIdOrKey(args),
    listCarts,
    listCustomers,
    listOrders,
    listProducts,
    name: "commercetools"
  };
}
