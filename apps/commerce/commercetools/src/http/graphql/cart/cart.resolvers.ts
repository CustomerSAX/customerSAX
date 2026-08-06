import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { getCartByIdOrKey, listCarts } from "../../../commercetools/api/index.js";
import { mapCart } from "./cart.mapper.js";
import type { CtCart } from "../../../commercetools/types.js";
import { compactWhere, escapeWhere, page, paging, sort, type PagingArgs } from "../shared/paging.js";
import type { CartSearchArgs } from "./cart.types.js";

export const resolvers = {
  cart: (_parent: unknown, args: { id?: string; key?: string }) => getCartByIdOrKey(args),
  carts: (_parent: unknown, args: PagingArgs) => listCarts(args),
  cartPage: async (_parent: unknown, args: PagingArgs) => {
    const items = await listCarts(args);

    return page(items, undefined, args.offset ?? 0);
  },
  searchCarts: async (_parent: unknown, args: CartSearchArgs) => queryCarts(cartSearchWhere(args), args),
  b2bCarts: async (
    _parent: unknown,
    args: PagingArgs & { businessUnitKey?: string; customerId?: string }
  ) =>
    queryCarts(
      compactWhere([
        args.customerId ? `customerId="${escapeWhere(args.customerId)}"` : undefined,
        args.businessUnitKey
          ? `businessUnit(key="${escapeWhere(args.businessUnitKey)}")`
          : undefined
      ]),
      args
    ),
  activeCartCount: async (_parent: unknown, args: { customerId: string }) => {
    const data = await commercetoolsGraphql<{ carts: { total?: number } }>(
      `#graphql
        query ActiveCartCount($where: String!) {
          carts(where: $where, limit: 1) { total }
        }
      `,
      { where: `customerId="${escapeWhere(args.customerId)}" and cartState="Active"` }
    );

    return data.carts.total ?? 0;
  },
  createB2bCart: async (
    _parent: unknown,
    args: { businessUnitKey?: string; currency: string; customerId?: string }
  ) => {
    const data = await commercetoolsGraphql<{ createCart: CtCart | null }>(
      `#graphql
        mutation CreateB2bCart($draft: CartDraft!) {
          createCart(draft: $draft) {
            id key customerId totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
          }
        }
      `,
      {
        draft: {
          businessUnit: args.businessUnitKey ? { key: args.businessUnitKey } : undefined,
          currency: args.currency,
          customerId: args.customerId
        }
      }
    );

    return mapCart(data.createCart);
  },
  placeOrderFromCart: async (_parent: unknown, args: { id: string }) => {
    const cart = await getCartVersion(args.id);

    return commercetoolsGraphql(
      `#graphql
        mutation CreateOrderFromCart($draft: OrderCartCommand!) {
          createOrderFromCart(draft: $draft) { id orderNumber orderState }
        }
      `,
      { draft: { id: args.id, version: cart.version } }
    );
  },
  addCartLineItem: async (_parent: unknown, args: { id: string; quantity: number; sku: string }) =>
    updateCart(args.id, [{ addLineItem: { quantity: args.quantity, sku: args.sku } }]),
  removeCartLineItem: async (_parent: unknown, args: { id: string; lineItemId: string }) =>
    updateCart(args.id, [{ removeLineItem: { lineItemId: args.lineItemId } }]),
  updateCartAddresses: async (
    _parent: unknown,
    args: { billingAddress?: unknown; id: string; shippingAddress?: unknown }
  ) =>
    updateCart(
      args.id,
      [
        args.shippingAddress ? { setShippingAddress: { address: args.shippingAddress } } : undefined,
        args.billingAddress ? { setBillingAddress: { address: args.billingAddress } } : undefined
      ].filter(Boolean)
    )
};

async function queryCarts(where: string | undefined, args: PagingArgs) {
  const { limit, offset } = paging(args);
  const data = await commercetoolsGraphql<{ carts: { results: CtCart[]; total?: number } }>(
    `#graphql
      query CartsPage($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
        carts(limit: $limit, offset: $offset, sort: $sort, where: $where) {
          total
          results {
            id key customerId totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
          }
        }
      }
    `,
    { limit, offset, sort: sort(args), where }
  );

  return page(data.carts.results.map(mapCart).filter(Boolean), data.carts.total, offset);
}

function cartSearchWhere(args: CartSearchArgs) {
  const text = escapeWhere(args.text.trim());

  if (!text) {
    return "id=\"\"";
  }

  switch (args.option) {
    case "id":
      return `id="${text}"`;
    case "customerEmail":
      return `customerEmail="${text}"`;
    default:
      return `id="${text}" or customerEmail="${text}" or customerId="${text}"`;
  }
}

async function getCartVersion(id: string) {
  const data = await commercetoolsGraphql<{ cart: { version: number } | null }>(
    `#graphql
      query CartVersion($id: String!) { cart(id: $id) { version } }
    `,
    { id }
  );

  if (!data.cart) {
    throw new Error("Cart not found.");
  }

  return data.cart;
}

async function updateCart(id: string, actions: unknown[]) {
  const cart = await getCartVersion(id);
  const data = await commercetoolsGraphql<{ updateCart: CtCart | null }>(
    `#graphql
      mutation UpdateCart($id: String!, $version: Long!, $actions: [CartUpdateAction!]!) {
        updateCart(id: $id, version: $version, actions: $actions) {
          id key customerId totalPrice { centAmount currencyCode fractionDigits }
          lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
        }
      }
    `,
    { actions, id, version: cart.version }
  );

  return mapCart(data.updateCart);
}
