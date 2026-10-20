import { createLogger } from "@csa/logger";
import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { getCartByIdOrKey, listCarts, getCustomerById } from "../../../commercetools/api/index.js";
import { mapCart, mapOrder } from "../../../commercetools/mappers.js";
import type { CtCart, CtOrder } from "../../../commercetools/types.js";
import {
  compactWhere,
  escapeWhere,
  page,
  paging,
  sort,
  type PagingArgs
} from "../shared/paging.js";
import type { CartSearchArgs, DiscountCodeArgs } from "./cart.types.js";

const log = createLogger("commercetools").child({ module: "cart.resolvers" });

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CtLocalizedString = {
  locale?: string;
  value?: string;
};

type CtDiscountCode = {
  id: string;
  key?: string | null;
  code: string;
  nameAllLocales?: CtLocalizedString[] | null;
  isActive?: boolean | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

const cartAddressFields = `#graphql
  streetNumber
  streetName
  apartment
  building
  pOBox
  city
  state
  postalCode
  country
  phone
  mobile
  additionalStreetInfo
  additionalAddressInfo
`;

export const resolvers = {
  cart: (_parent: unknown, args: { id?: string; key?: string }) => getCartByIdOrKey(args),
  carts: async (_parent: unknown, args: PagingArgs) => {
    const cartPage = await listCarts(args);

    return cartPage.results;
  },
  cartPage: (_parent: unknown, args: PagingArgs) => listCarts(args),
  searchCarts: async (_parent: unknown, args: CartSearchArgs) =>
    queryCarts(cartSearchWhere(args), args),
  b2bCarts: async (
    _parent: unknown,
    args: PagingArgs & { businessUnitKey?: string; customerId?: string }
  ) => {
    let customerClause: string | undefined;
    if (args.customerId) {
      let email: string | undefined;
      try {
        const cust = await getCustomerById(args.customerId);
        if (cust?.email) email = cust.email;
      } catch {
        // ignore
      }
      customerClause = email
        ? `(customerId="${escapeWhere(args.customerId)}" or customerEmail="${escapeWhere(email)}")`
        : `customerId="${escapeWhere(args.customerId)}"`;
    }

    return queryCarts(
      compactWhere([
        customerClause,
        args.businessUnitKey
          ? `businessUnit(key="${escapeWhere(args.businessUnitKey)}")`
          : undefined
      ]),
      args
    );
  },
  activeCartCount: async (_parent: unknown, args: { customerId: string }) => {
    let customerClause = `customerId="${escapeWhere(args.customerId)}"`;
    try {
      const cust = await getCustomerById(args.customerId);
      if (cust?.email) {
        customerClause = `(customerId="${escapeWhere(args.customerId)}" or customerEmail="${escapeWhere(cust.email)}")`;
      }
    } catch {
      // ignore
    }

    const data = await commercetoolsGraphql<{ carts: { total?: number } }>(
      `#graphql
        query ActiveCartCount($where: String!) {
          carts(where: $where, limit: 1) { total }
        }
      `,
      { where: `${customerClause} and cartState="Active"` }
    );

    return data.carts.total ?? 0;
  },
  discountCodes: async (_parent: unknown, args: DiscountCodeArgs) => {
    const data = await commercetoolsGraphql<{
      discountCodes: { results?: CtDiscountCode[] };
    }>(
      `#graphql
        query DiscountCodes($limit: Int!) {
          discountCodes(limit: $limit) {
            results {
              id
              key
              code
              nameAllLocales { locale value }
              isActive
              validFrom
              validUntil
            }
          }
        }
      `,
      { limit: args.limit ?? 100 }
    );

    return (data.discountCodes.results ?? []).map((discount) => ({
      id: discount.id,
      key: discount.key,
      code: discount.code,
      name: localizedName(discount.nameAllLocales) || discount.key || discount.code,
      isActive: discount.isActive ?? true,
      validFrom: discount.validFrom,
      validUntil: discount.validUntil
    }));
  },
  createB2bCart: async (
    _parent: unknown,
    args: {
      businessUnitKey?: string;
      currency: string;
      customerId?: string;
      customerEmail?: string;
    }
  ) => {
    const data = await commercetoolsGraphql<{ createCart: CtCart | null }>(
      `#graphql
        mutation CreateB2bCart($draft: CartDraft!) {
          createCart(draft: $draft) {
            id version key customerId customerEmail createdAt lastModifiedAt cartState
            shippingAddress { ${cartAddressFields} }
            billingAddress { ${cartAddressFields} }
            totalPrice { centAmount currencyCode fractionDigits }
            shippingInfo { shippingMethod { id name } price { centAmount currencyCode fractionDigits } }
            discountCodes { discountCode { code } }
            lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
          }
        }
      `,
      {
        draft: {
          businessUnit: args.businessUnitKey?.trim() ? { key: args.businessUnitKey.trim() } : undefined,
          currency: args.currency,
          // An empty id from a caller means "no customer" — commercetools
          // rejects "" as an invalid id rather than ignoring it.
          customerId: args.customerId?.trim() || undefined,
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
    return createOrderWithUniqueNumber(args.id, cart.version);
  },
  addCartLineItem: async (
    _parent: unknown,
    args: { id: string; quantity: number; sku: string }
  ) => {
    // A cart with no country can't select a country-scoped price (see
    // countryForSku) — set it from the item's own real prices first.
    const cart = await getCartPricingContext(args.id);
    const country = cart.country ? null : await countryForSku(args.sku, cart.currency);
    return updateCart(args.id, [
      ...(country ? [{ setCountry: { country } }] : []),
      { addLineItem: { quantity: args.quantity, sku: args.sku } }
    ]);
  },
  removeCartLineItem: async (
    _parent: unknown,
    args: { id: string; lineItemId: string }
  ) => updateCart(args.id, [{ removeLineItem: { lineItemId: args.lineItemId } }]),
  changeCartLineItemQuantity: async (
    _parent: unknown,
    args: { id: string; lineItemId: string; quantity: number }
  ) =>
    updateCart(args.id, [
      args.quantity <= 0
        ? { removeLineItem: { lineItemId: args.lineItemId } }
        : {
            changeLineItemQuantity: {
              lineItemId: args.lineItemId,
              quantity: args.quantity
            }
          }
    ]),
  setCartLineItemPrice: async (
    _parent: unknown,
    args: { centAmount: number; currencyCode: string; fractionDigits?: number; id: string; lineItemId: string }
  ) =>
    updateCart(args.id, [
      {
        setLineItemPrice: {
          externalPrice: {
            centPrecision: {
              centAmount: args.centAmount,
              currencyCode: args.currencyCode
            }
          },
          lineItemId: args.lineItemId
        }
      }
    ]),
  updateCartAddresses: async (
    _parent: unknown,
    args: { billingAddress?: unknown; id: string; shippingAddress?: unknown }
  ) => {
    // The cart's country drives price selection. When it isn't set yet, the
    // shipping address's country is the customer's real country — adopt it.
    // An already-set country is never changed here (that would re-price items).
    const shippingCountry = (args.shippingAddress as { country?: unknown } | undefined)?.country;
    const adoptCountry =
      typeof shippingCountry === "string" && shippingCountry.trim() && !(await getCartPricingContext(args.id)).country
        ? shippingCountry.trim().toUpperCase()
        : null;
    return updateCart(
      args.id,
      [
        adoptCountry ? { setCountry: { country: adoptCountry } } : undefined,
        args.shippingAddress
          ? { setShippingAddress: { address: args.shippingAddress } }
          : undefined,
        args.billingAddress
          ? { setBillingAddress: { address: args.billingAddress } }
          : undefined
      ].filter(Boolean)
    );
  },
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
  setCartShippingMethod: async (
    _parent: unknown,
    args: { id: string; shippingMethodId: string }
  ) =>
    updateCart(args.id, [
      { setShippingMethod: { shippingMethod: { id: args.shippingMethodId } } }
    ]),
  addCartDiscountCode: async (_parent: unknown, args: { id: string; code: string }) =>
    updateCart(args.id, [{ addDiscountCode: { code: args.code } }])
};

async function queryCarts(where: string | undefined, args: PagingArgs) {
  const { limit, offset } = paging(args);
  const data = await commercetoolsGraphql<{
    carts: { results: CtCart[]; total?: number };
  }>(
    `#graphql
      query CartsPage($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
        carts(limit: $limit, offset: $offset, sort: $sort, where: $where) {
          total
          results {
            id version key customerId customerEmail createdAt lastModifiedAt cartState
            shippingAddress { ${cartAddressFields} }
            billingAddress { ${cartAddressFields} }
            totalPrice { centAmount currencyCode fractionDigits }
            shippingInfo { shippingMethod { id name } price { centAmount currencyCode fractionDigits } }
            discountCodes { discountCode { code } }
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

  const isUuid = UUID_REGEX.test(text);

  let base: string;
  switch (args.option) {
    case "id":
      base = `id="${text}"`;
      break;
    case "customerEmail":
      base = `customerEmail="${text}"`;
      break;
    default:
      base = isUuid
        ? `id="${text}" or customerEmail="${text}" or customerId="${text}"`
        : `customerEmail="${text}"`;
  }

  // Always restrict to Active carts.  commercetools changes a cart's state to
  // "Ordered" when it is converted to an order (placeOrderFromCart), and to
  // "Merged" when two carts are merged.  Any mutation on a non-Active cart
  // throws "Cannot perform operation. Cart is not in Active state." — so we
  // must never surface those carts to callers in the first place.
  return `(${base}) and cartState="Active"`;
}

/** The cart's country and currency — the two inputs commercetools uses to select a line item's price. */
async function getCartPricingContext(id: string): Promise<{ country: string | null; currency: string }> {
  const data = await commercetoolsGraphql<{
    cart: { country?: string | null; totalPrice: { currencyCode: string } } | null;
  }>(
    `#graphql
      query CartPricingContext($id: String!) { cart(id: $id) { country totalPrice { currencyCode } } }
    `,
    { id }
  );
  if (!data.cart) throw new Error("Cart not found.");
  return { country: data.cart.country ?? null, currency: data.cart.totalPrice.currencyCode };
}

/**
 * commercetools picks a line item's price by the cart's currency AND country.
 * Carts created without a country therefore can't take an item whose prices
 * are all country-scoped ("does not contain a price for currency 'USD' all
 * countries…") — e.g. b2c-csa's Orion Double Bed is priced in USD for US only.
 *
 * Resolves the country from the item's own real prices for the cart currency:
 *  - a country-less price exists, or no price at all → null (nothing to set;
 *    commercetools reports a genuinely missing price itself)
 *  - priced for exactly one country → that country
 *  - priced for several countries → an error asking for the shipping address,
 *    since picking one would be a guess
 */
async function countryForSku(sku: string, currency: string): Promise<string | null> {
  type Variant = { sku?: string | null; prices?: Array<{ country?: string | null; value: { currencyCode: string } }> | null };
  const data = await commercetoolsGraphql<{
    products: { results: Array<{ masterData: { current: { masterVariant: Variant; variants: Variant[] } } }> };
  }>(
    `#graphql
      query PricesBySku($where: String!) {
        products(where: $where, limit: 1) {
          results { masterData { current {
            masterVariant { sku prices { country value { currencyCode } } }
            variants { sku prices { country value { currencyCode } } }
          } } }
        }
      }
    `,
    { where: `masterData(current(masterVariant(sku=${JSON.stringify(sku)}) or variants(sku=${JSON.stringify(sku)})))` }
  );
  const current = data.products.results[0]?.masterData.current;
  const variant = current && [current.masterVariant, ...current.variants].find((v) => v.sku === sku);
  const prices = (variant?.prices ?? []).filter((p) => p.value.currencyCode === currency);
  if (prices.length === 0 || prices.some((p) => !p.country)) return null;

  const countries = [...new Set(prices.map((p) => p.country as string))];
  if (countries.length === 1) return countries[0];
  throw new Error(
    `'${sku}' is priced in ${currency} for several countries (${countries.join(", ")}). ` +
      "Set the cart's shipping address first so the right country's price is used."
  );
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

/** A candidate order number in this project's existing "ORD-RC-XXXXXX" format. */
function generateOrderNumber(): string {
  return `ORD-RC-${Math.floor(100000 + Math.random() * 900000)}`;
}

/**
 * commercetools enforces `orderNumber` uniqueness and rejects a collision
 * outright (a `DuplicateField` error). That makes the store — not a pre-check
 * query — the real source of truth: a "is it taken?" query before creating the
 * order is a classic time-of-check/time-of-use race (two concurrent placements
 * can both see the number free, then one fails anyway). So instead of
 * pre-checking, we attempt creation with a fresh number and retry ONLY on a
 * duplicate-orderNumber error, letting commercetools arbitrate uniqueness.
 */
async function createOrderWithUniqueNumber(cartId: string, cartVersion: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const data = await commercetoolsGraphql<{ createOrderFromCart: CtOrder | null }>(
        `#graphql
          mutation CreateOrderFromCart($draft: OrderCartCommand!) {
            createOrderFromCart(draft: $draft) {
              id version orderNumber orderState paymentState shipmentState createdAt lastModifiedAt customerId customerEmail
              totalPrice { centAmount currencyCode fractionDigits }
              shippingInfo { shippingMethod { id name } price { centAmount currencyCode fractionDigits } }
              discountCodes { discountCode { code } }
              lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
            }
          }
        `,
        {
          draft: {
            id: cartId,
            version: cartVersion,
            orderNumber: generateOrderNumber(),
            paymentState: "Pending",
            shipmentState: "Pending"
          }
        }
      );

      const order = mapOrder(data.createOrderFromCart);
      log.info("ct:createOrderFromCart", {
        id: data.createOrderFromCart?.id ?? cartId,
        ok: true
      });
      return order;
    } catch (error) {
      // A duplicate order number is the only error worth retrying — a fresh
      // number will resolve it. Any other error (invalid cart, version
      // conflict, auth) is real and must surface immediately, unretried.
      // The failed create does not mutate the cart, so the same version is
      // still valid for the next attempt.
      if (!isDuplicateOrderNumberError(error)) {
        log.info("ct:createOrderFromCart", { id: cartId, ok: false });
        throw error;
      }
      lastError = error;
    }
  }
  log.info("ct:createOrderFromCart", { id: cartId, ok: false });
  throw lastError ?? new Error("Could not allocate a unique order number");
}

function localizedName(values?: CtLocalizedString[] | null) {
  return (
    values?.find((entry) => entry.locale === "en" && entry.value)?.value ??
    values?.find((entry) => entry.value)?.value
  );
}

/** True when a create failed specifically because the order number was taken. */
function isDuplicateOrderNumberError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const isDuplicate =
    message.includes("duplicatefield") ||
    message.includes("duplicate") ||
    message.includes("already exists");
  const mentionsOrderNumber =
    message.includes("ordernumber") || message.includes("order number");
  return isDuplicate && mentionsOrderNumber;
}

async function updateCart(id: string, actions: unknown[]) {
  const cart = await getCartVersion(id);
  const data = await commercetoolsGraphql<{ updateCart: CtCart | null }>(
    `#graphql
      mutation UpdateCart($id: String!, $version: Long!, $actions: [CartUpdateAction!]!) {
        updateCart(id: $id, version: $version, actions: $actions) {
          id version key customerId customerEmail createdAt lastModifiedAt cartState
          shippingAddress { ${cartAddressFields} }
          billingAddress { ${cartAddressFields} }
          totalPrice { centAmount currencyCode fractionDigits }
          shippingInfo { shippingMethod { id name } price { centAmount currencyCode fractionDigits } }
          discountCodes { discountCode { code } }
          lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
        }
      }
    `,
    { actions, id, version: cart.version }
  );

  return mapCart(data.updateCart);
}
