/**
 * The commercetools implementation of the platform-neutral `CommerceProvider`
 * port (defined in `@csa/commerce-contract`). This factory IS the adapter seam:
 * every backend platform (commercetools, and the shopify/bigcommerce/sfcc
 * stubs) returns the same `CommerceProvider` shape, so a caller depends only on
 * the contract and never on commercetools directly. Swapping the backing store
 * is "return a different provider here" with zero change to callers.
 *
 * Keep this file a thin wiring layer: it maps the neutral port methods onto the
 * native commercetools API helpers in `./api`. The `getCustomer`/`getOrder`
 * branches pick the right native lookup based on which identifier the caller
 * supplied; all real query/mapping logic lives in `./api` and `./mappers.ts`.
 */
import type { CommerceProvider } from "@csa/commerce-contract";
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
