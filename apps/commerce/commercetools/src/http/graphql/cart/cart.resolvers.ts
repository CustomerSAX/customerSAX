import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { getCartByIdOrKey, listCarts } from "../../../commercetools/api/index.js";
import { mapCart, mapOrder } from "../../../commercetools/mappers.js";
import type { CtCart, CtOrder } from "../../../commercetools/types.js";
import { compactWhere, escapeWhere, page, paging, sort, type PagingArgs } from "../shared/paging.js";
import type { CartSearchArgs } from "./cart.types.js";

export const resolvers = {
  cart: (_parent: unknown, args: { id?: string; key?: string }) => getCartByIdOrKey(args),
  carts: async (_parent: unknown, args: PagingArgs) => {
    const cartPage = await listCarts(args);

    return cartPage.results;
  },
  cartPage: (_parent: unknown, args: PagingArgs) => listCarts(args),
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
    args: { businessUnitKey?: string; currency: string; customerId?: string; customerEmail?: string }
  ) => {
    const data = await commercetoolsGraphql<{ createCart: CtCart | null }>(
      `#graphql
        mutation CreateB2bCart($draft: CartDraft!) {
          createCart(draft: $draft) {
            id version key customerId totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
          }
        }
      `,
      {
        draft: {
          businessUnit: args.businessUnitKey ? { key: args.businessUnitKey } : undefined,
          currency: args.currency,
          customerId: args.customerId,
          // Without this, orders placed from this cart show a blank
          // customer email in Merchant Center even though the cart is
          // correctly linked to a real customerId — commercetools does not
          // auto-derive customerEmail from the customer link, it has to be
          // set explicitly on the draft.
          customerEmail: args.customerEmail
        }
      }
    );

    return mapCart(data.createCart);
  },
  placeOrderFromCart: async (_parent: unknown, args: { id: string }) => {
    const cart = await getCartVersion(args.id);
    const orderNumber = await generateUniqueOrderNumber();

    const data = await commercetoolsGraphql<{ createOrderFromCart: CtOrder | null }>(
      `#graphql
        mutation CreateOrderFromCart($draft: OrderCartCommand!) {
          createOrderFromCart(draft: $draft) {
            id version orderNumber orderState paymentState shipmentState createdAt lastModifiedAt customerId customerEmail
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
          }
        }
      `,
      {
        draft: {
          id: args.id,
          version: cart.version,
          orderNumber,
          paymentState: "Pending",
          shipmentState: "Pending"
        }
      }
    );

    return mapOrder(data.createOrderFromCart);
  },
  addCartLineItem: async (_parent: unknown, args: { id: string; quantity: number; sku: string }) =>
    updateCart(args.id, [{ addLineItem: { quantity: args.quantity, sku: args.sku } }]),
  removeCartLineItem: async (_parent: unknown, args: { id: string; lineItemId: string }) =>
    updateCart(args.id, [{ removeLineItem: { lineItemId: args.lineItemId } }]),
  changeCartLineItemQuantity: async (_parent: unknown, args: { id: string; lineItemId: string; quantity: number }) =>
    updateCart(args.id, [
      args.quantity <= 0
        ? { removeLineItem: { lineItemId: args.lineItemId } }
        : { changeLineItemQuantity: { lineItemId: args.lineItemId, quantity: args.quantity } }
    ]),
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
    ),
  shippingMethods: async (_parent: unknown, args: { limit?: number }) => {
    const data = await commercetoolsGraphql<Record<string, unknown>>(
      `#graphql
        query ShippingMethods($limit: Int!) {
          shippingMethods(limit: $limit) { results { id key name } }
        }
      `,
      { limit: args.limit ?? 20 }
    );

    // Defensive: commercetools' real shippingMethods field shape (plain
    // array vs. { results } pagination wrapper) — accept either so this
    // never returns null for a non-nullable field.
    const raw = data.shippingMethods as unknown;
    if (Array.isArray(raw)) return raw;
    const wrapped = raw as { results?: unknown } | null | undefined;
    return Array.isArray(wrapped?.results) ? wrapped.results : [];
  },
  setCartShippingMethod: async (_parent: unknown, args: { id: string; shippingMethodId: string }) =>
    updateCart(args.id, [{ setShippingMethod: { shippingMethod: { id: args.shippingMethodId } } }])
};

async function queryCarts(where: string | undefined, args: PagingArgs) {
  const { limit, offset } = paging(args);
  const data = await commercetoolsGraphql<{ carts: { results: CtCart[]; total?: number } }>(
    `#graphql
      query CartsPage($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
        carts(limit: $limit, offset: $offset, sort: $sort, where: $where) {
          total
          results {
            id version key customerId totalPrice { centAmount currencyCode fractionDigits }
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
    return `id="" and cartState="Active"`;
  }

  let base: string;
  switch (args.option) {
    case "id":
      base = `id="${text}"`;
      break;
    case "customerEmail":
      base = `customerEmail="${text}"`;
      break;
    default:
      base = `id="${text}" or customerEmail="${text}" or customerId="${text}"`;
  }

  // Always restrict to Active carts.  commercetools changes a cart's state to
  // "Ordered" when it is converted to an order (placeOrderFromCart), and to
  // "Merged" when two carts are merged.  Any mutation on a non-Active cart
  // throws "Cannot perform operation. Cart is not in Active state." — so we
  // must never surface those carts to callers in the first place.
  return `(${base}) and cartState="Active"`;
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

/**
 * Generates an order number in this project's existing "ORD-RC-XXXXXX" seed
 * format and confirms it isn't already taken (commercetools enforces
 * uniqueness and rejects a collision outright, so a random 6-digit number
 * verified up front is far cheaper than handling a failed order placement).
 */
async function generateUniqueOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `ORD-RC-${Math.floor(100000 + Math.random() * 900000)}`;
    const data = await commercetoolsGraphql<{ orders: { total?: number } }>(
      `#graphql
        query OrderNumberTaken($where: String!) { orders(where: $where, limit: 1) { total } }
      `,
      { where: `orderNumber="${candidate}"` }
    );
    if (!data.orders.total) {
      return candidate;
    }
  }
  // Extremely unlikely fallback — timestamp-suffixed, still within the
  // project's format, essentially guaranteed unique.
  return `ORD-RC-${Date.now().toString().slice(-6)}`;
}

async function updateCart(id: string, actions: unknown[]) {
  const cart = await getCartVersion(id);
  const data = await commercetoolsGraphql<{ updateCart: CtCart | null }>(
    `#graphql
      mutation UpdateCart($id: String!, $version: Long!, $actions: [CartUpdateAction!]!) {
        updateCart(id: $id, version: $version, actions: $actions) {
          id version key customerId totalPrice { centAmount currencyCode fractionDigits }
          lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
        }
      }
    `,
    { actions, id, version: cart.version }
  );

  return mapCart(data.updateCart);
}
