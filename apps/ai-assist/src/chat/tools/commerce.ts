/**
 * Commerce tools — each tool executes a BFF GraphQL call.
 * Tool names are generic (not CT-specific) so the system prompt
 * stays platform-agnostic. The platform-specific work happens
 * inside the BFF subgraph.
 */

import { createHash } from "crypto";
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { withIdempotency } from "@csa/mongodb";
import { bffQuery, formatMoney } from "../../commerce/graphql-client.js";
import { contextStorage, getSystemPromptContext } from "../system-prompt.js";
import { instrumentTools } from "./instrument.js";
import { config } from "../../config.js";
import { guardWriteTools } from "./write-guard.js";
import { RESOLUTION_REASONS } from "./ui-tools.js";

const log = createLogger("ai-assist").child({ module: "tools/commerce" });

// ─── Fragments shared across tools ───────────────────────────────────────────

const MONEY_FRAGMENT = `centAmount currencyCode fractionDigits`;
const ADDRESS_FRAGMENT = `streetName streetNumber city state postalCode country`;
const ORDER_FIELDS = `
  id orderNumber customerId customerEmail state orderState createdAt lastModifiedAt
  shipmentState paymentState
  totalPrice { ${MONEY_FRAGMENT} }
  lineItems { id productId sku name quantity totalPrice { ${MONEY_FRAGMENT} } }
  shippingAddress { ${ADDRESS_FRAGMENT} }
  billingAddress { ${ADDRESS_FRAGMENT} }
  deliveries { id createdAt parcels { trackingId carrier provider isReturn } }
  returnInfo {
    returnTrackingId
    returnDate
    items {
      id
      type
      quantity
      lineItemId
      shipmentState
      paymentState
      comment
    }
  }
`;
const CART_FIELDS = `
  id version key customerId customerEmail currencyCode
  totalPrice { ${MONEY_FRAGMENT} }
  lineItems { id productId sku name quantity totalPrice { ${MONEY_FRAGMENT} } }
  discountCodeStates { code state }
  totalDiscount { ${MONEY_FRAGMENT} }
`;
const CUSTOMER_FIELDS = `
  id customerNumber email firstName lastName companyName
  customerGroup { id key name }
  version createdAt lastModifiedAt
`;

/**
 * Enriches an order record with full customer profile details (name, email, etc.)
 * so the AI assistant and UI cards receive actual customer identity rather than
 * treating the order as an anonymous or guest order.
 */
async function enrichOrderWithCustomer(order: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!order) return order;
  const customerId = (order.customerId as string) || undefined;
  const customerEmail = (order.customerEmail as string) || undefined;

  if (!customerId && !customerEmail) {
    return {
      ...order,
      customer: null
    };
  }

  try {
    let customerRecord: Record<string, unknown> | null = null;
    if (customerId) {
      const custData = await bffQuery<{ customer: Record<string, unknown> | null }>(
        `query FindCustomerById($id: ID) {
          customer(id: $id) { ${CUSTOMER_FIELDS} }
        }`,
        { id: customerId }
      );
      customerRecord = custData.customer ?? null;
    }

    if (!customerRecord && customerEmail) {
      const custData = await bffQuery<{ customer: Record<string, unknown> | null }>(
        `query FindCustomerByEmail($email: String) {
          customer(email: $email) { ${CUSTOMER_FIELDS} }
        }`,
        { email: customerEmail }
      );
      customerRecord = custData.customer ?? null;
    }

    if (customerRecord) {
      const fullName = [customerRecord.firstName, customerRecord.lastName].filter(Boolean).join(" ").trim();
      return {
        ...order,
        customer: {
          ...customerRecord,
          name: fullName || (customerRecord.email as string) || (order.customerEmail as string) || "Customer",
          email: (customerRecord.email as string) || (order.customerEmail as string) || undefined
        }
      };
    }
  } catch (err) {
    log.warn("Failed to enrich order with customer profile", { customerId, customerEmail, err });
  }

  if (customerEmail) {
    return {
      ...order,
      customer: {
        id: customerId,
        email: customerEmail,
        name: customerEmail
      }
    };
  }

  return order;
}

// ─── find_customer ────────────────────────────────────────────────────────────

export const findCustomerTool = tool({
  description:
    "Look up a customer by email, ID, or full name. For B2B employees, search by name or email.",
  inputSchema: z.object({
    email: z.string().optional().describe("Customer's email address"),
    customerId: z.string().optional().describe("Customer's platform ID"),
    name: z.string().optional().describe("Full or partial customer name to search for")
  }),
  execute: async ({ email, customerId, name }) => {
    try {
      if (customerId || email) {
        const data = await bffQuery<{ customer: Record<string, unknown> | null }>(
          `query FindCustomer($id: ID, $email: String) {
            customer(id: $id, email: $email) { ${CUSTOMER_FIELDS} }
          }`,
          { id: customerId, email }
        );
        if (data.customer) {
          return { total: 1, customers: [data.customer] };
        }
        return { total: 0, customers: [] };
      }

      if (name) {
        const data = await bffQuery<{ searchCustomers: { results: Record<string, unknown>[] } }>(
          `query SearchCustomers($text: String, $limit: Int) {
            searchCustomers(text: $text, limit: $limit) {
              results { ${CUSTOMER_FIELDS} }
            }
          }`,
          { text: name, limit: 10 }
        );
        const results = data.searchCustomers?.results ?? [];
        return { total: results.length, customers: results };
      }

      return { total: 0, customers: [] };
    } catch (err) {
      // IMPORTANT: this must stay distinguishable from "genuinely zero
      // matches" above. Collapsing a real backend failure into the same
      // { total: 0, customers: [] } shape used to make the assistant tell
      // reps "I couldn't find that customer" when the actual problem was
      // the commerce backend being unreachable — a false negative, not a
      // real answer. See the GLOBAL RULE for how `error` should be handled.
      return { error: String(err), total: 0, customers: [] };
    }
  }
});

// ─── find_b2b_customer ────────────────────────────────────────────────────────

export const findB2bCustomerTool = tool({
  description:
    "Search for B2B customers (business account holders, associates, employees) using name or email.",
  inputSchema: z.object({
    searchText: z.string().describe("Name, email, or company to search for"),
    searchField: z.string().optional().describe("Field to search in (name, email, companyName)"),
    limit: z.number().optional().default(10)
  }),
  execute: async ({ searchText, searchField, limit }) => {
    try {
      const data = await bffQuery<{ b2bCustomers: { results: unknown[]; total: number } }>(
        `query B2BCustomers($searchField: String, $searchText: String, $limit: Int) {
          b2bCustomers(searchField: $searchField, searchText: $searchText, limit: $limit) {
            results { ${CUSTOMER_FIELDS} }
            total
          }
        }`,
        { searchText, searchField, limit }
      );
      return data.b2bCustomers;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── get_order ────────────────────────────────────────────────────────────────

/**
 * Looks up one order by internal id or human order number. An order number
 * that `order(orderNumber)` misses is retried through `orderPage(orderRef)`,
 * which also matches migrated/alternate references. Returns null when the
 * order genuinely doesn't exist; throws on a backend failure.
 *
 * Shared by `get_order` and the voice agent so both resolve orders identically.
 */
export async function lookupOrder(ref: { orderId?: string; orderNumber?: string }): Promise<Record<string, unknown> | null> {
  const data = await bffQuery<{ order: Record<string, unknown> | null }>(
    `query GetOrder($id: ID, $orderNumber: String) {
      order(id: $id, orderNumber: $orderNumber) { ${ORDER_FIELDS} }
    }`,
    { id: ref.orderId, orderNumber: ref.orderNumber }
  );
  if (data.order) return data.order;
  if (!ref.orderNumber) return null;

  const fallbackData = await bffQuery<{ orderPage: { results: Record<string, unknown>[] } }>(
    `query FallbackGetOrder($orderRef: String) {
      orderPage(orderRef: $orderRef, limit: 1) {
        results { ${ORDER_FIELDS} }
      }
    }`,
    { orderRef: ref.orderNumber }
  );
  return fallbackData.orderPage?.results?.[0] ?? null;
}

/**
 * Lists a customer's most recent orders (newest first) by email. Email, not
 * customerId, because guest and migrated orders carry `customerId: null`.
 */
export async function listOrdersByEmail(customerEmail: string, limit: number): Promise<Record<string, unknown>[]> {
  const data = await bffQuery<{ orderPage: { results: Record<string, unknown>[] } }>(
    `query CustomerOrdersByEmail($customerEmail: String, $limit: Int) {
      orderPage(customerEmail: $customerEmail, limit: $limit, sortKey: "createdAt", sortOrder: "desc") {
        results { ${ORDER_FIELDS} }
      }
    }`,
    { customerEmail, limit }
  );
  return data.orderPage?.results ?? [];
}

// ─── get_latest_orders ────────────────────────────────────────────────────────

/** Order states commercetools uses — "open orders" means orderState Open. */
const ORDER_STATES = ["Open", "Confirmed", "Complete", "Cancelled"] as const;

export const getLatestOrdersTool = tool({
  description:
    "The store's most recent orders, newest first, whatever their age — use for 'latest order', 'last order', " +
    "'most recent orders', 'last 5 orders', 'latest open orders'. Not limited to a time window, so it always returns " +
    "the real latest orders when any exist. The studio shows them as order cards.",
  inputSchema: z.object({
    limit: z.number().int().describe("How many orders: 1 for 'the latest order', else what the rep asked for (max 20); 5 when unsaid"),
    orderState: z
      .enum(["any", ...ORDER_STATES])
      .describe("Only orders in this state ('Open' for 'open orders'); 'any' when the rep didn't say")
  }),
  execute: async ({ limit, orderState }) => {
    const want = Math.min(Math.max(Math.round(limit) || 5, 1), 20);
    const state = orderState === "any" ? null : orderState;
    try {
      const found: Record<string, unknown>[] = [];
      let total = 0;
      // Without a state filter the first page is enough; with one, page on until enough match.
      for (let page = 0; page < (state ? 5 : 1) && found.length < want; page++) {
        const data = await bffQuery<{ orderPage: { results: Record<string, unknown>[]; total: number } }>(
          `query LatestOrders($limit: Int, $offset: Int) {
            orderPage(limit: $limit, offset: $offset, sortKey: "createdAt", sortOrder: "desc") {
              total
              results { ${ORDER_FIELDS} }
            }
          }`,
          { limit: state ? 100 : want, offset: page * 100 }
        );
        total = data.orderPage?.total ?? 0;
        const results = data.orderPage?.results ?? [];
        found.push(...results.filter((o) => !state || (o.orderState ?? o.state) === state));
        if (results.length < (state ? 100 : want)) break;
      }
      const orders = await Promise.all(found.slice(0, want).map((o) => enrichOrderWithCustomer(o)));
      return {
        orders,
        order: orders[0] ?? null,
        total: orders.length,
        storeOrderCount: total,
        ...(orders.length === 0 ? { note: state ? `No ${state} orders among the store's newest orders.` : "This store has no orders yet." } : {})
      };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

export const getOrderTool = tool({
  description:
    "Retrieve a specific order by ID or order number, or list recent orders for a customer by their ID or email.",
  inputSchema: z.object({
    orderId: z.string().optional().describe("Internal order ID"),
    orderNumber: z.string().optional().describe("Human-readable order number (e.g. ORD-12345)"),
    customerId: z.string().optional().describe("Customer ID to list recent orders for"),
    customerEmail: z.string().optional().describe("Customer email to list recent orders for"),
    limit: z.number().optional().default(5).describe("Max orders when listing by customer")
  }),
  execute: async ({ orderId, orderNumber, customerId, customerEmail, limit }) => {
    try {
      if (orderId || orderNumber) {
        const orderRecord = await lookupOrder({ orderId, orderNumber });

        if (orderRecord) {
          const enriched = await enrichOrderWithCustomer(orderRecord);
          return { order: enriched, orders: [enriched], total: 1 };
        }
        return { order: null, orders: [], total: 0 };
      }

      if (customerId || customerEmail) {
        let resolvedEmail = customerEmail;
        let resolvedId = customerId;
        if (customerId && !customerEmail) {
          try {
            const custData = await bffQuery<{ customer: Record<string, unknown> | null }>(
              `query ResolveCustomerEmail($id: ID) { customer(id: $id) { email } }`,
              { id: customerId }
            );
            if (custData.customer?.email) resolvedEmail = custData.customer.email as string;
          } catch {
            // ignore
          }
        } else if (customerEmail && !customerId) {
          try {
            const custData = await bffQuery<{ customer: Record<string, unknown> | null }>(
              `query ResolveCustomerId($email: String) { customer(email: $email) { id } }`,
              { email: customerEmail }
            );
            if (custData.customer?.id) resolvedId = custData.customer.id as string;
          } catch {
            // ignore
          }
        }

        const data = await bffQuery<{ orderPage: { results: Record<string, unknown>[]; total: number } }>(
          `query CustomerOrders($customerId: ID, $customerEmail: String, $limit: Int) {
            orderPage(customerId: $customerId, customerEmail: $customerEmail, limit: $limit, sortKey: "createdAt", sortOrder: "desc") {
              results { ${ORDER_FIELDS} }
              total
            }
          }`,
          { customerId: resolvedId, customerEmail: resolvedEmail, limit }
        );
        const results = await Promise.all((data.orderPage?.results ?? []).map(enrichOrderWithCustomer));
        return { order: results[0] ?? null, orders: results, total: data.orderPage?.total ?? results.length };
      }

      return { order: null, orders: [], total: 0 };
    } catch (err) {
      // Same reasoning as find_customer above — keep backend failures
      // distinguishable from a genuine "no such order" result.
      return { error: String(err), order: null, orders: [], total: 0 };
    }
  }
});

// ─── b2b_orders ───────────────────────────────────────────────────────────────

export const b2bOrdersTool = tool({
  description:
    "List orders placed by a B2B business unit or a specific employee/associate within that unit.",
  inputSchema: z.object({
    businessUnitKey: z.string().optional().describe("Business unit key (e.g. acme-corp)"),
    customerId: z.string().optional().describe("Associate/employee customer ID"),
    limit: z.number().optional().default(10)
  }),
  execute: async ({ businessUnitKey, customerId, limit }) => {
    try {
      const data = await bffQuery<{ b2bOrders: { results: Record<string, unknown>[]; total: number } }>(
        `query B2BOrders($businessUnitKey: String, $customerId: ID, $limit: Int) {
          b2bOrders(businessUnitKey: $businessUnitKey, customerId: $customerId, limit: $limit, sortKey: "createdAt", sortOrder: "desc") {
            results { ${ORDER_FIELDS} }
            total
          }
        }`,
        { businessUnitKey, customerId, limit }
      );
      if (data.b2bOrders?.results) {
        const enriched = await Promise.all(data.b2bOrders.results.map(enrichOrderWithCustomer));
        return { ...data.b2bOrders, results: enriched };
      }
      return data.b2bOrders;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── view_cart ────────────────────────────────────────────────────────────────

export const viewCartTool = tool({
  description:
    "Retrieve a cart by ID or key, or search for carts belonging to a customer.",
  inputSchema: z.object({
    cartId: z.string().optional().describe("Cart ID"),
    key: z.string().optional().describe("Cart key"),
    searchText: z.string().optional().describe("Customer name or email to search carts for")
  }),
  execute: async ({ cartId, key, searchText }) => {
    try {
      if (cartId || key) {
        const data = await bffQuery<{ cart: unknown }>(
          `query ViewCart($id: ID, $key: String) {
            cart(id: $id, key: $key) { ${CART_FIELDS} }
          }`,
          { id: cartId, key }
        );
        return data.cart ?? { error: "Cart not found" };
      }

      if (searchText) {
        const data = await bffQuery<{
          searchCarts: { results: Array<Record<string, unknown> & { cartState?: string; lastModifiedAt?: string }>; total: number };
        }>(
          `query SearchCarts($text: String!, $limit: Int) {
            searchCarts(text: $text, limit: $limit) {
              results { ${CART_FIELDS} cartState createdAt lastModifiedAt }
              total
            }
          }`,
          { text: searchText, limit: 20 }
        );
        // Only carts still being shopped (Active), newest first: the first is
        // the customer's current cart — the one new items go into (create_cart
        // reuses it) — and any others are older leftovers.
        const active = (data.searchCarts?.results ?? [])
          .filter((c) => c.cartState === "Active")
          .sort((a, b) => String(b.lastModifiedAt ?? "").localeCompare(String(a.lastModifiedAt ?? "")));
        return {
          results: active,
          total: active.length,
          currentCartId: (active[0]?.id as string | undefined) ?? null,
          olderCartCount: Math.max(0, active.length - 1)
        };
      }

      return { error: "Provide cartId, key, or searchText" };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── b2b_carts ────────────────────────────────────────────────────────────────

export const b2bCartsTool = tool({
  description: "List active carts for a B2B business unit or associate.",
  inputSchema: z.object({
    businessUnitKey: z.string().optional().describe("Business unit key"),
    customerId: z.string().optional().describe("Associate/employee customer ID"),
    limit: z.number().optional().default(10)
  }),
  execute: async ({ businessUnitKey, customerId, limit }) => {
    try {
      const data = await bffQuery<{ b2bCarts: { results: unknown[]; total: number } }>(
        `query B2BCarts($businessUnitKey: String, $customerId: ID, $limit: Int) {
          b2bCarts(businessUnitKey: $businessUnitKey, customerId: $customerId, limit: $limit) {
            results { ${CART_FIELDS} }
            total
          }
        }`,
        { businessUnitKey, customerId, limit }
      );
      return data.b2bCarts;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── Catalog products (search_products / list_products) ──────────────────────
//
// Both tools return the same card-ready shape, and the studio renders product
// cards straight from that output — so cards appear every time, with values
// that came from commercetools, instead of depending on the model remembering
// to call product_card once per product.

type LocalizedValue = { locale: string; value: string };
type RawCatalogProduct = {
  id: string;
  masterData?: {
    current?: {
      nameAllLocales?: LocalizedValue[];
      descriptionAllLocales?: LocalizedValue[];
      categories?: Array<{ nameAllLocales?: LocalizedValue[] }>;
      masterVariant?: {
        id?: number;
        sku?: string | null;
        images?: Array<{ url: string }>;
        prices?: Array<{ value: { centAmount: number; currencyCode: string; fractionDigits?: number } }>;
        availability?: { noChannel?: { isOnStock?: boolean; availableQuantity?: number | null } | null } | null;
      };
    };
  };
};

export type CatalogProduct = {
  productId: string;
  sku: string | null;
  variantId: string;
  name: string;
  description: string | null;
  category: string | null;
  image: string | null;
  /** Formatted price in the requested currency; null when the product has no price in it. */
  price: string | null;
  /** "Out of stock" / "12 in stock"; null when commercetools has no inventory record (unknown, not "in stock"). */
  stock: string | null;
};

function localized(values: LocalizedValue[] | undefined): string | null {
  if (!values?.length) return null;
  return (values.find((v) => v.locale === "en-US") ?? values.find((v) => v.locale.startsWith("en")) ?? values[0]).value;
}

function toCatalogProduct(raw: RawCatalogProduct, currency: string): CatalogProduct {
  const current = raw.masterData?.current;
  const variant = current?.masterVariant;
  const price = variant?.prices?.find((p) => p.value.currencyCode === currency);
  const inventory = variant?.availability?.noChannel;
  const quantity = inventory?.availableQuantity;
  const description = localized(current?.descriptionAllLocales);
  return {
    productId: raw.id,
    sku: variant?.sku ?? null,
    variantId: String(variant?.id ?? 1),
    name: localized(current?.nameAllLocales) ?? variant?.sku ?? raw.id,
    description: description && description.length > 240 ? `${description.slice(0, 237)}…` : description,
    category: localized(current?.categories?.[0]?.nameAllLocales),
    image: variant?.images?.[0]?.url ?? null,
    price: price ? formatMoney(price.value) : null,
    stock: !inventory
      ? null
      : inventory.isOnStock === false || quantity === 0
        ? "Out of stock"
        : typeof quantity === "number"
          ? `${quantity} in stock`
          : "In stock"
  };
}

async function catalogSearch(args: { text?: string; currency: string; limit: number; offset: number }) {
  const ctx = getSystemPromptContext();
  if (!ctx.clientId || !ctx.projectKey || ctx.canViewProducts === false)
    throw new Error("Product access and an active project are required.");
  const selection = await bffQuery<{ projectConnectionHubProducts: { selected: boolean; results: Record<string, unknown>[]; total: number | null } }>(
    `query SelectedProductConnector($query: String, $limit: Int) {
      projectConnectionHubProducts(query: $query, limit: $limit) { selected results total }
    }`,
    { query: args.text ?? "", limit: args.limit }
  );
  const hub = selection.projectConnectionHubProducts;
  if (!hub || typeof hub.selected !== "boolean") throw new Error("Unable to resolve the selected product connector.");
  if (hub.selected) {
    if (args.offset > 0) throw new Error("Further pages are not supported by the selected Algolia connector.");
    return {
      source: "algolia", total: hub.total, count: hub.results.length, records: hub.results,
      display: "These are records from the project's selected Algolia connector. Summarize the returned fields as text. Report missing prices, currency or stock honestly. Algolia objectIDs are not commerce product IDs: do not create native product cards, Details links or cart actions from these IDs."
    };
  }
  const currency = args.currency.trim().toUpperCase();
  const data = await bffQuery<{ productSearch: { results: RawCatalogProduct[]; total: number } }>(
    `query CatalogSearch($text: String, $browse: Boolean, $currency: String, $limit: Int, $offset: Int) {
      productSearch(text: $text, browse: $browse, currency: $currency, limit: $limit, offset: $offset)
    }`,
    { text: args.text ? singularSearchText(args.text) : undefined, browse: !args.text, currency, limit: args.limit, offset: args.offset }
  );
  const products = (data.productSearch?.results ?? []).map((p) => toCatalogProduct(p, currency));
  return {
    total: data.productSearch?.total ?? products.length,
    count: products.length,
    offset: args.offset,
    currency,
    products,
    display:
      products.length > 0
        ? "These products are ALREADY shown to the rep as product cards (name, price, stock, Add to cart, Details). " +
          "Reply with ONE sentence only, e.g. 'Here are 10 of 37 matching products.' — say 'products', not the search term, because matches " +
          "include products whose description mentions it. Do NOT list, number or describe the products, and do NOT call product_card for them."
        : "No products matched."
  };
}

/**
 * The catalog text search is a substring match, so "beds" misses "Opal King
 * Bed" while "bed" finds both. Reduce plain English plurals to the singular —
 * a strictly broader search. SKUs/codes (anything with a digit) are untouched.
 */
function singularSearchText(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (/\d/.test(word) || word.length <= 3) return word;
      if (/(ss|x|ch|sh)es$/i.test(word)) return word.slice(0, -2);
      if (/[^s]s$/i.test(word)) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

const CURRENCY_INPUT = z
  .string()
  .min(3)
  .max(3)
  .describe("Project currency code for prices (from list_regions or this conversation, e.g. USD)");

export const searchProductsTool = tool({
  description:
    "Search products using the project’s selected Algolia connector, or Native commerce when Algolia is not selected. Native results become product cards; external Algolia records must be summarized as text without native cart or Details actions.",
  inputSchema: z.object({
    query: z.string().describe("Search term (product name, SKU, keyword)"),
    currency: CURRENCY_INPUT,
    limit: z.number().int().min(1).max(20).optional().default(10)
  }),
  execute: async ({ query, currency, limit }) => {
    try {
      return await catalogSearch({ text: query.trim(), currency, limit, offset: 0 });
    } catch (err) {
      return { error: "Product search is unavailable. Check the selected connector. Do not substitute another catalog." };
    }
  }
});

export const listProductsTool = tool({
  description:
    "Browse products using the project’s selected Algolia connector, or Native commerce when Algolia is not selected. Algolia supports the first page only and returns read-only records for text; Native supports pagination and product cards.",
  inputSchema: z.object({
    currency: CURRENCY_INPUT,
    limit: z.number().int().min(1).max(20).optional().default(10),
    offset: z.number().int().min(0).optional().default(0)
  }),
  execute: async ({ currency, limit, offset }) => {
    try {
      return await catalogSearch({ currency, limit, offset });
    } catch (err) {
      return { error: "Product browsing is unavailable. Check the selected connector and supported page range. Do not substitute another catalog." };
    }
  }
});

// ─── create_cart ──────────────────────────────────────────────────────────────

/**
 * The customer's most recently modified Active cart in `currency`, or null.
 * Matched on the customer id or email the cart actually carries; B2B
 * (business-unit) carts are never reused here.
 */
async function findReusableCart(currency: string, customerId?: string, customerEmail?: string): Promise<Record<string, unknown> | null> {
  const text = customerEmail || customerId;
  if (!text) return null;
  const data = await bffQuery<{
    searchCarts: { results: Array<Record<string, unknown> & { cartState?: string; lastModifiedAt?: string; customerId?: string | null; customerEmail?: string | null; currencyCode?: string }> };
  }>(
    `query ReusableCarts($text: String!) {
      searchCarts(text: $text, limit: 20) { results { ${CART_FIELDS} cartState lastModifiedAt } }
    }`,
    { text }
  );
  const email = customerEmail?.toLowerCase();
  const mine = (data.searchCarts?.results ?? []).filter(
    (c) =>
      c.cartState === "Active" &&
      c.currencyCode === currency &&
      ((customerId && c.customerId === customerId) || (email && c.customerEmail?.toLowerCase() === email))
  );
  mine.sort((a, b) => String(b.lastModifiedAt ?? "").localeCompare(String(a.lastModifiedAt ?? "")));
  return mine[0] ?? null;
}

export const createCartTool = tool({
  description:
    "Create a new cart for a customer. Executes immediately — no approval needed. " +
    "For a normal (non-B2B) order, pass customerId AND customerEmail (from the find_customer result " +
    "that resolved this customer) and omit businessUnitKey entirely — skipping customerEmail is how " +
    "orders end up placed with no customer email on record in commercetools. " +
    "Only pass businessUnitKey if one was explicitly confirmed for THIS customer this turn " +
    "(e.g. from find_b2b_customer) — never reuse a business unit key seen earlier in the " +
    "conversation for a different customer, and never invent one: an incorrect key fails " +
    "with a 'business-unit ... was not found' error and blocks the whole cart from being created.",
  inputSchema: z.object({
    currency: z.string().default("USD").describe("ISO currency code (e.g. USD, EUR)"),
    customerId: z.string().optional().describe("Customer ID to attach the cart to"),
    customerEmail: z.string().optional().describe("Customer's email — always pass this alongside customerId when known"),
    businessUnitKey: z
      .string()
      .optional()
      .describe("B2B business unit key — omit for a normal order; never guess or reuse one from a different customer"),
    startFresh: z
      .boolean()
      .default(false)
      .describe("true ONLY when the rep explicitly asks for a separate new cart; otherwise the customer's existing active cart is reused")
  }),
  execute: async ({ currency, customerId, customerEmail, businessUnitKey, startFresh }) => {
    try {
      // commercetools allows any number of active carts per customer, so
      // starting every order with a new cart left customers with several.
      // Reuse their latest active cart in this currency instead.
      if (!startFresh && !businessUnitKey?.trim()) {
        const existing = await findReusableCart(currency, customerId?.trim(), customerEmail?.trim());
        if (existing) {
          return {
            ...existing,
            reused: true,
            note: "This customer already had an active cart in this currency, so it is being reused instead of creating another. Tell the rep it already contains these items."
          };
        }
      }
      const data = await bffQuery<{ createB2bCart: unknown }>(
        `mutation CreateCart($currency: String!, $customerId: ID, $customerEmail: String, $businessUnitKey: String) {
          createB2bCart(currency: $currency, customerId: $customerId, customerEmail: $customerEmail, businessUnitKey: $businessUnitKey) {
            ${CART_FIELDS}
          }
        }`,
        // The model fills every optional field, often with "" — an empty id
        // isn't "no customer" to commercetools, it's an invalid id.
        {
          currency,
          customerId: customerId?.trim() || undefined,
          customerEmail: customerEmail?.trim() || undefined,
          businessUnitKey: businessUnitKey?.trim() || undefined
        }
      );
      return data.createB2bCart ?? { error: "Cart creation failed" };
    } catch (err) {
      const message = String(err);
      // The federated BFF gateway only introspects subgraph schemas once at
      // startup (no polling) — if it hasn't been restarted since customerEmail
      // was added to createB2bCart, EVERY call here fails with "Unknown
      // argument customerEmail", even when the variable is undefined, because
      // the argument name itself is baked into the query text, not just the
      // variables. Retrying with a query that omits the argument entirely
      // keeps cart creation working regardless of gateway restart timing —
      // the email just won't be recorded on the cart until it is restarted.
      // Loose match on purpose: the raw HTTP response body embedded in this
      // message has its quotes backslash-escaped as literal JSON text (not
      // parsed), so "customerEmail" isn't reliably adjacent to a plain `"` —
      // matching on the words alone avoids that escaping mismatch entirely.
      if (/unknown argument/i.test(message) && /customerEmail/i.test(message)) {
        try {
          const fallback = await bffQuery<{ createB2bCart: unknown }>(
            `mutation CreateCartNoEmail($currency: String!, $customerId: ID, $businessUnitKey: String) {
              createB2bCart(currency: $currency, customerId: $customerId, businessUnitKey: $businessUnitKey) {
                ${CART_FIELDS}
              }
            }`,
            { currency, customerId, businessUnitKey }
          );
          return fallback.createB2bCart ?? { error: "Cart creation failed" };
        } catch (fallbackErr) {
          return { error: String(fallbackErr) };
        }
      }
      return { error: message };
    }
  }
});

// ─── add_to_cart ──────────────────────────────────────────────────────────────

export const addToCartTool = tool({
  description:
    "Add a product SKU to an existing cart. Executes immediately — no approval needed. " +
    "If the result contains CART_STALE, call create_cart for the same customer to start a fresh cart, " +
    "then call add_to_cart again with the new cart ID — do not ask the rep, just recover silently.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID to add items to"),
    sku: z.string().describe("Product SKU"),
    quantity: z.number().int().min(1).default(1).describe("Quantity to add")
  }),
  execute: async ({ cartId, sku, quantity }) => {
    try {
      const data = await bffQuery<{ addCartLineItem: unknown }>(
        `mutation AddToCart($id: ID!, $sku: String!, $quantity: Int!) {
          addCartLineItem(id: $id, sku: $sku, quantity: $quantity) { ${CART_FIELDS} }
        }`,
        { id: cartId, sku, quantity }
      );
      return data.addCartLineItem ?? { error: "Failed to add item" };
    } catch (err) {
      const message = String(err);
      // commercetools rejects mutations on carts that were placed as orders
      // (state: "Ordered") or merged (state: "Merged").  Return a structured
      // CART_STALE signal so the model knows to create a new cart and retry
      // rather than halting and asking the rep to intervene.
      if (/active/i.test(message) && (/not in/i.test(message) || /state/i.test(message))) {
        return {
          error: "CART_STALE",
          staleCartId: cartId,
          instruction:
            "The cart is no longer Active — it was placed as an order in a previous session. " +
            "Call create_cart for the same customer (same customerId + customerEmail) to get a fresh cart, " +
            "then call add_to_cart again with the new cart ID. Do not ask the rep — recover silently.",
        };
      }
      return { error: message };
    }
  }
});

// ─── update_cart_address ────────────────────────────────────────────────────

const cartAddressInput = z.object({
  name: z.string().describe("Full name — will be split into firstName/lastName"),
  street: z.string(),
  city: z.string(),
  postalCode: z.string().describe("Postal/ZIP code"),
  country: z.string().describe("ISO 3166-1 alpha-2 country code, e.g. US")
});

function toCtAddress(addr: z.infer<typeof cartAddressInput>) {
  const [firstName, ...rest] = addr.name.trim().split(/\s+/);
  return {
    city: addr.city,
    country: addr.country,
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
    postalCode: addr.postalCode,
    streetName: addr.street
  };
}

export const updateCartAddressTool = tool({
  description:
    "Set the billing and/or shipping address on a cart. Executes immediately — no approval needed " +
    "(a draft cart operation, not a commitment write). commercetools requires a shipping address on " +
    "the cart before an order can be placed from it, so this must run before place_order.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID"),
    billing: cartAddressInput.optional().describe("Billing address — omit to leave unchanged"),
    shipping: cartAddressInput
      .optional()
      .describe("Shipping address — omit to reuse the billing address (sameAsBilling)")
  }),
  execute: async ({ cartId, billing, shipping }) => {
    try {
      const billingAddress = billing ? toCtAddress(billing) : undefined;
      const shippingAddress = shipping ? toCtAddress(shipping) : billingAddress;
      const data = await bffQuery<{ updateCartAddresses: unknown }>(
        `mutation UpdateCartAddress($id: ID!, $shippingAddress: Json, $billingAddress: Json) {
          updateCartAddresses(id: $id, shippingAddress: $shippingAddress, billingAddress: $billingAddress) { ${CART_FIELDS} }
        }`,
        { billingAddress, id: cartId, shippingAddress }
      );
      if (!data.updateCartAddresses) return { error: "Failed to set address" };
      return {
        ...(data.updateCartAddresses as Record<string, unknown>),
        nextStep: "Address set. If this is a checkout, call list_shipping_methods now so the rep can pick a shipping method."
      };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── list_shipping_methods ──────────────────────────────────────────────────

export const listShippingMethodsTool = tool({
  description:
    "List real shipping methods available in this project, with their real ids. " +
    "Call this before update_cart_shipping_method — never invent a shipping method id " +
    "or reuse a label the rep typed (e.g. \"standard\", \"express\") as if it were a real id.",
  inputSchema: z.object({
    limit: z.number().optional().default(20)
  }),
  execute: async ({ limit }) => {
    try {
      const data = await bffQuery<{ shippingMethods: Array<{ id: string; key?: string; name?: string }> }>(
        `query ShippingMethods($limit: Int) {
          shippingMethods(limit: $limit) { id key name }
        }`,
        { limit }
      );
      const methods = (data.shippingMethods ?? []).map((m) => ({ id: m.id, name: (m.name ?? m.key ?? m.id).trim() }));
      // The studio shows these as a shipping-method card with one button per
      // method — or, when there are none, a clear "no shipping methods" card.
      return {
        methods,
        count: methods.length,
        display:
          methods.length > 0
            ? "These methods are ALREADY shown to the rep as buttons on a shipping-method card. Reply with one short line; don't list them."
            : "This store has NO shipping methods set up, so an order can't be placed until one is added in the commerce admin. Say exactly that in one line (never 'try again later'); the card offers a ticket."
      };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── update_cart_shipping_method ────────────────────────────────────────────

export const updateCartShippingMethodTool = tool({
  description:
    "Set a real shipping method on a cart, by its real id (from list_shipping_methods). Executes " +
    "immediately — no approval needed (a draft cart operation). commercetools requires a shipping " +
    "address on the cart before a shipping method can be set — call update_cart_address first if the " +
    "cart doesn't have one yet, or this fails with a 'Shipping address is not set' error.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID"),
    shippingMethodId: z.string().describe("Real shipping method ID from list_shipping_methods")
  }),
  execute: async ({ cartId, shippingMethodId }) => {
    try {
      const data = await bffQuery<{ setCartShippingMethod: unknown }>(
        `mutation SetCartShippingMethod($id: ID!, $shippingMethodId: ID!) {
          setCartShippingMethod(id: $id, shippingMethodId: $shippingMethodId) { ${CART_FIELDS} }
        }`,
        { id: cartId, shippingMethodId }
      );
      return data.setCartShippingMethod ?? { error: "Failed to set shipping method" };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── remove_from_cart ─────────────────────────────────────────────────────────

export const removeFromCartTool = tool({
  description: "Remove a line item from a cart by its line item ID.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID"),
    lineItemId: z.string().describe("Line item ID to remove")
  }),
  execute: async ({ cartId, lineItemId }) => {
    try {
      const data = await bffQuery<{ removeCartLineItem: unknown }>(
        `mutation RemoveFromCart($id: ID!, $lineItemId: ID!) {
          removeCartLineItem(id: $id, lineItemId: $lineItemId) { ${CART_FIELDS} }
        }`,
        { id: cartId, lineItemId }
      );
      return data.removeCartLineItem ?? { error: "Failed to remove item" };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── delete_cart ──────────────────────────────────────────────────────────────

export const deleteCartTool = tool({
  description:
    "Delete one of a customer's active carts (e.g. an old duplicate or an empty cart). ALWAYS require action_approval first. " +
    "Carts already turned into orders can't be deleted.",
  inputSchema: z.object({ cartId: z.string().describe("Cart ID to delete") }),
  execute: async ({ cartId }) => {
    try {
      const data = await bffQuery<{ deleteCart: boolean }>(`mutation DeleteCart($id: ID!) { deleteCart(id: $id) }`, { id: cartId });
      return data.deleteCart ? { deleted: true, cartId } : { error: "The cart was not deleted." };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── Discount codes ───────────────────────────────────────────────────────────
//
// commercetools accepts some codes onto a cart without discounting anything
// (used up, conditions not met, blocked by another discount), so every result
// carries the code's real state, not just "added". Draft cart changes — the
// final total is still approved at place_order.

const DISCOUNT_STATE_MEANING: Record<string, string> = {
  MatchesCart: "applied — the discount is on the cart",
  DoesNotMatchCart: "on the cart but not discounting anything: this cart doesn't meet the code's conditions (products, minimum amount, customer group…)",
  MaxApplicationReached: "on the cart but not discounting anything: the code has reached its usage limit",
  NotActive: "on the cart but not discounting anything: the code is inactive",
  NotValid: "on the cart but not discounting anything: the code is outside its validity dates",
  ApplicationStoppedByPreviousDiscount: "on the cart but not discounting anything: another discount already on the cart blocks it"
};

/** commercetools' errors name codes by internal id; restate them with the code the rep typed. */
function discountCodeError(err: unknown, code: string): string {
  const raw = String(err);
  if (/was not found/i.test(raw)) return `Discount code '${code}' doesn't exist in this store.`;
  if (/not active/i.test(raw)) return `Discount code '${code}' is inactive.`;
  if (/does not contain active and valid/i.test(raw)) return `Discount code '${code}' has no active, valid discount behind it right now.`;
  if (/not applied to this cart/i.test(raw)) return `Discount code '${code}' isn't applied to this cart.`;
  return raw;
}

type CartWithDiscounts = {
  discountCodeStates?: Array<{ code: string; state?: string | null }> | null;
  totalDiscount?: { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null;
} & Record<string, unknown>;

function discountSummary(cart: CartWithDiscounts) {
  const total = cart.totalPrice as { centAmount?: number; currencyCode?: string; fractionDigits?: number } | undefined;
  return {
    // The cart's real total, discounts already applied. Report THIS number —
    // subtracting totalDiscount from it would count the saving twice.
    cartTotal: total ? formatMoney(total) : null,
    totalAlreadyIncludesDiscount: true,
    codes: (cart.discountCodeStates ?? []).map((c) => ({
      code: c.code,
      state: c.state ?? null,
      applies: c.state === "MatchesCart",
      meaning: (c.state && DISCOUNT_STATE_MEANING[c.state]) ?? "status not reported"
    })),
    totalDiscount: cart.totalDiscount ? formatMoney(cart.totalDiscount) : null
  };
}

export const applyDiscountCodeTool = tool({
  description:
    "Apply a discount / promo / coupon code to a cart (e.g. 'apply SAVE10'). Draft cart change — no approval needed. " +
    "The result says whether the code actually discounts (applies) and, if not, why; report that honestly, then call cart_summary.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID"),
    code: z.string().min(1).describe("The code exactly as the rep gave it")
  }),
  execute: async ({ cartId, code }) => {
    const trimmed = code.trim();
    try {
      const data = await bffQuery<{ addCartDiscountCode: CartWithDiscounts | null }>(
        `mutation ApplyDiscountCode($id: ID!, $code: String!) {
          addCartDiscountCode(id: $id, code: $code) { ${CART_FIELDS} }
        }`,
        { id: cartId, code: trimmed }
      );
      if (!data.addCartDiscountCode) return { error: "Cart not found" };
      const summary = discountSummary(data.addCartDiscountCode);
      const thisCode = summary.codes.find((c) => c.code.toLowerCase() === trimmed.toLowerCase()) ?? null;
      return { code: trimmed, applied: thisCode?.applies ?? false, codeStatus: thisCode, ...summary, cart: data.addCartDiscountCode };
    } catch (err) {
      return { error: discountCodeError(err, trimmed) };
    }
  }
});

export const removeDiscountCodeTool = tool({
  description: "Remove a discount code from a cart. Draft cart change — no approval needed. Call cart_summary afterwards.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID"),
    code: z.string().min(1).describe("The code to remove")
  }),
  execute: async ({ cartId, code }) => {
    const trimmed = code.trim();
    try {
      const data = await bffQuery<{ removeCartDiscountCode: CartWithDiscounts | null }>(
        `mutation RemoveDiscountCode($id: ID!, $code: String!) {
          removeCartDiscountCode(id: $id, code: $code) { ${CART_FIELDS} }
        }`,
        { id: cartId, code: trimmed }
      );
      if (!data.removeCartDiscountCode) return { error: "Cart not found" };
      return { removed: trimmed, ...discountSummary(data.removeCartDiscountCode), cart: data.removeCartDiscountCode };
    } catch (err) {
      return { error: discountCodeError(err, trimmed) };
    }
  }
});

export const listDiscountCodesTool = tool({
  description: "List the store's currently active discount codes (code, name, validity). Use when the rep asks which codes exist.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const data = await bffQuery<{
        discountCodes: Array<{ code: string; name?: string | null; isActive: boolean; validFrom?: string | null; validUntil?: string | null }>;
      }>(`query ActiveDiscountCodes { discountCodes(limit: 100) { code name isActive validFrom validUntil } }`, {});
      const now = Date.now();
      const active = (data.discountCodes ?? []).filter(
        (d) =>
          d.isActive &&
          (!d.validFrom || Date.parse(d.validFrom) <= now) &&
          (!d.validUntil || Date.parse(d.validUntil) >= now)
      );
      return {
        codes: active.map((d) => ({ code: d.code, name: d.name ?? null, validUntil: d.validUntil ?? null })),
        count: active.length,
        note: "Active codes can still be used up or not match a given cart — apply_discount_code reports the real result."
      };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── change_cart_quantity ─────────────────────────────────────────────────────

export const changeCartQuantityTool = tool({
  description:
    "Set a cart line item to a new total quantity (e.g. 'make it 3' → quantity 3). Use this instead of removing and re-adding. " +
    "Quantity 0 removes the line. Draft cart operation — no approval needed.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID"),
    lineItemId: z.string().describe("Line item ID from view_cart / the cart in this conversation"),
    quantity: z.number().int().min(0).max(999).describe("New TOTAL quantity for the line (not a delta)")
  }),
  execute: async ({ cartId, lineItemId, quantity }) => {
    try {
      const data = await bffQuery<{ changeCartLineItemQuantity: unknown }>(
        `mutation ChangeCartQuantity($id: ID!, $lineItemId: ID!, $quantity: Int!) {
          changeCartLineItemQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) { ${CART_FIELDS} }
        }`,
        { id: cartId, lineItemId, quantity }
      );
      return data.changeCartLineItemQuantity ?? { error: "Failed to change the quantity" };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── Idempotency helpers for write tools ────────────────────────────────────
//
// The studio's approval flow only tracks an in-memory boolean, so a
// double-submit (double-click "Place order", a client retry of a slow request)
// could execute the same money-moving write twice. `withIdempotency` (durable
// in Mongo, unique index on the key) collapses duplicates to a single execution
// and replays the stored result for repeats. Keys are derived from
// (operation, resource id, projectKey) — plus a payload signature for returns,
// so genuinely distinct returns on the same order stay independent.

function currentProjectKey(): string {
  return contextStorage.getStore()?.projectKey ?? "default";
}

function payloadSignature(payload: unknown): string {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex").slice(0, 12);
}

// ─── place_order ──────────────────────────────────────────────────────────────

export const placeOrderTool = tool({
  description:
    "Convert a cart into a confirmed order. ALWAYS require action_approval before calling this tool.",
  inputSchema: z.object({
    cartId: z.string().describe("Cart ID to place as an order")
  }),
  execute: async ({ cartId }) => {
    try {
      const outcome = await withIdempotency<unknown>({
        key: `place_order:${currentProjectKey()}:${cartId}`,
        operation: "place_order",
        exec: async () => {
          const data = await bffQuery<{ placeOrderFromCart: unknown }>(
            `mutation PlaceOrder($id: ID!) { placeOrderFromCart(id: $id) }`,
            { id: cartId }
          );
          // Throw (rather than store an error result) so a genuine failure
          // releases the idempotency claim and a later retry can execute.
          if (data.placeOrderFromCart == null) throw new Error("Order placement failed");
          return data.placeOrderFromCart;
        }
      });
      const orderId =
        (outcome.result && typeof outcome.result === "object"
          ? (outcome.result as { id?: string }).id
          : typeof outcome.result === "string"
            ? outcome.result
            : undefined) ?? cartId;
      log.info("write:place_order", { targetId: orderId, cartId, ok: true });
      return outcome.result;
    } catch (err) {
      log.info("write:place_order", { targetId: cartId, ok: false });
      return { error: String(err) };
    }
  }
});

// ─── cancel_order ─────────────────────────────────────────────────────────────

export const cancelOrderTool = tool({
  description:
    "Cancel an order. ALWAYS require action_approval before calling this tool.",
  inputSchema: z.object({
    orderId: z.string().describe("Order ID to cancel"),
    reason: z.string().optional().describe("Cancellation reason for records")
  }),
  execute: async ({ orderId, reason }) => {
    try {
      // commercetools' real GraphQL API models update actions as
      // { actionName: { ...params } } — a named field per action, NOT the
      // REST API's { action: "actionName", ...params } shape. Using the
      // REST shape here fails validation outright ("Field 'action' is not
      // defined in the input type 'OrderUpdateAction'").
      const actions: Array<Record<string, unknown>> = [{ changeOrderState: { orderState: "Cancelled" } }];
      if (reason) {
        actions.push({ setCustomField: { name: "cancellationReason", value: reason } });
      }
      const outcome = await withIdempotency<{ success: true; result: unknown }>({
        key: `cancel_order:${currentProjectKey()}:${orderId}`,
        operation: "cancel_order",
        exec: async () => {
          const data = await bffQuery<{ updateOrder: unknown }>(
            `mutation CancelOrder($id: ID!, $actions: Json!) { updateOrder(id: $id, actions: $actions) }`,
            { id: orderId, actions }
          );
          return { success: true as const, result: data.updateOrder };
        }
      });
      log.info("write:cancel_order", { targetId: orderId, ok: outcome.result != null });
      return outcome.result ?? { error: "Order cancellation failed" };
    } catch (err) {
      log.info("write:cancel_order", { targetId: orderId, ok: false });
      return { error: String(err) };
    }
  }
});

// ─── start_return ─────────────────────────────────────────────────────────────

export const startReturnTool = tool({
  description:
    "Start a return/refund process for specific line items and quantities. Needs the rep's approval: an approved " +
    "action_approval card, or a `return.confirm` click (return card / stepper) for this order. Quantities can't " +
    "exceed what is still returnable on each line.",
  inputSchema: z.object({
    orderId: z.string().describe("Order ID"),
    reason: z.string().describe("Return reason code (e.g. defective_product, wrong_item)"),
    comment: z.string().optional().describe("Additional notes from the customer"),
    lineItems: z.array(z.object({
      lineItemId: z.string(),
      quantity: z.number().int().min(1),
      sku: z.string().optional(),
      name: z.string().optional()
    })).describe("Line items being returned")
  }),
  execute: async ({ orderId, reason, comment, lineItems }) => {
    try {
      // Key includes a signature of the return payload so a true double-submit
      // (identical items+reason) collapses, while two genuinely different
      // returns on the same order remain independent operations.
      const signature = payloadSignature({ reason, comment, lineItems });
      const outcome = await withIdempotency<{ success: true; returnTrackingId: string; result: unknown }>({
        key: `start_return:${currentProjectKey()}:${orderId}:${signature}`,
        operation: "start_return",
        exec: async () => {
          // Never record more than is still returnable: ordered quantity minus
          // what earlier returns on this order already covered.
          const current = await bffQuery<{ order: CtOrderForReturn | null }>(
            `query OrderForReturn($id: ID) { order(id: $id) { ${ORDER_FIELDS} } }`,
            { id: orderId }
          );
          if (!current.order) throw new Error("Order not found");
          const remaining = returnableQuantities(current.order);
          for (const li of lineItems) {
            const left = remaining.get(li.lineItemId);
            if (left === undefined) throw new Error(`Line item ${li.lineItemId} is not on this order`);
            if (li.quantity > left) {
              throw new Error(`Only ${left} of ${li.name ?? li.sku ?? li.lineItemId} can still be returned (asked for ${li.quantity})`);
            }
          }

          const returnTrackingId = `CSA-RETURN-${Date.now()}`;
          // Real commercetools ReturnItemDraftType has no `type` or
          // `paymentState` field (only lineItemId/customLineItemId, quantity,
          // shipmentState, comment) — those extra fields, and the wrapping
          // `{action: "addReturnInfo", returnInfo: {...}}` REST-style shape,
          // both fail GraphQL validation. See cancel_order's comment above for
          // why the action must be `{addReturnInfo: {...}}` directly.
          const returnComment = `${reason}${comment ? ` — ${comment}` : ""}`;
          const actions = [
            {
              addReturnInfo: {
                items: lineItems.map((li: { lineItemId: string; quantity: number }) => ({
                  comment: returnComment,
                  lineItemId: li.lineItemId,
                  quantity: li.quantity,
                  shipmentState: "Returned"
                })),
                returnDate: new Date().toISOString(),
                returnTrackingId
              }
            }
          ];

          const data = await bffQuery<{ updateOrder: unknown }>(
            `mutation StartReturn($id: ID!, $actions: Json!) { updateOrder(id: $id, actions: $actions) }`,
            { id: orderId, actions }
          );
          return { success: true as const, returnTrackingId, result: data.updateOrder };
        }
      });
      log.info("write:start_return", { targetId: orderId, returnTrackingId: outcome.result?.returnTrackingId, ok: outcome.result != null });
      return outcome.result ?? { error: "Return could not be started" };
    } catch (err) {
      log.info("write:start_return", { targetId: orderId, ok: false });
      return { error: String(err) };
    }
  }
});

// ─── check_return_eligibility ─────────────────────────────────────────────────

export type CtOrderForReturn = {
  id: string;
  orderNumber?: string | null;
  state: string;
  createdAt: string;
  shipmentState?: string | null;
  paymentState?: string | null;
  totalPrice?: { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null;
  lineItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    sku?: string | null;
    totalPrice?: { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null;
  }>;
  returnInfo?: Array<{ items?: Array<{ lineItemId?: string | null; quantity: number }> | null }> | null;
};

/**
 * Line items (still returnable) whose name matches any of the words the rep
 * used — "jacket" matches "Corduroy Shirt Jacket". Only pre-selects; the rep
 * still confirms on the card.
 */
function matchLineItems(order: CtOrderForReturn, mentioned: string[]): string[] {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const terms = mentioned.map(norm).filter((t) => t.length >= 3).map((t) => t.replace(/s$/, ""));
  if (terms.length === 0) return [];
  const remaining = returnableQuantities(order);
  return (order.lineItems ?? [])
    .filter((li) => (remaining.get(li.id) ?? 0) > 0)
    .filter((li) => terms.some((t) => norm(li.name).includes(t) || (li.sku ? norm(li.sku).includes(t) : false)))
    .map((li) => li.id);
}

/** Per line item: ordered quantity minus what earlier returns on the order already cover. */
function returnableQuantities(order: CtOrderForReturn): Map<string, number> {
  const returned = new Map<string, number>();
  for (const info of order.returnInfo ?? []) {
    for (const item of info.items ?? []) {
      if (item.lineItemId) returned.set(item.lineItemId, (returned.get(item.lineItemId) ?? 0) + item.quantity);
    }
  }
  return new Map((order.lineItems ?? []).map((li) => [li.id, Math.max(0, li.quantity - (returned.get(li.id) ?? 0))]));
}

// commercetools' real ShipmentState enum. Only these two mean physical goods
// actually left the warehouse — everything else (Pending/Ready/Backorder/
// Delayed) means nothing has shipped yet, so there is nothing to return.
// "Delivered" is a real commercetools ShipmentState too — a delivered order
// has certainly shipped (it used to be treated as "nothing shipped yet").
const SHIPPED_STATES = new Set(["Shipped", "Partial", "Delivered"]);

function formatOrderForReturn(order: CtOrderForReturn) {
  const remaining = returnableQuantities(order);
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? undefined,
    totalPrice: formatMoney(order.totalPrice),
    lineItems: (order.lineItems ?? []).map((li) => ({
      lineItemId: li.id,
      name: li.name,
      quantity: li.quantity,
      returnableQuantity: remaining.get(li.id) ?? 0,
      sku: li.sku ?? undefined,
      price: formatMoney(li.totalPrice)
    }))
  };
}

export type ReturnEligibility = {
  eligible: boolean;
  reason?: string;
  daysSince?: number;
  returnWindowDays?: number;
  daysRemaining?: number;
  orderState?: string;
  shipmentState?: string | null;
  paymentState?: string | null;
};

/** Return window in days — config.returns.windowDays (env RETURN_WINDOW_DAYS, default 30). */
const RETURN_WINDOW_DAYS = config.returns.windowDays;

/**
 * The single return-eligibility rule, gated on the order's real current
 * state/shipmentState/paymentState and age (see .claude/rules/commercetools.md).
 * Pure — the caller fetches the order. Shared by `check_return_eligibility` and
 * the voice agent so both always give the same answer.
 */
export function evaluateReturnEligibility(order: CtOrderForReturn): ReturnEligibility {
  const orderDate = new Date(order.createdAt);
  const daysSince = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
  const returnWindowDays = RETURN_WINDOW_DAYS;
  const paymentState = order.paymentState ?? null;
  const shipmentState = order.shipmentState ?? null;

  const nonReturnableStates = ["Cancelled", "ReturnReceived"];
  if (nonReturnableStates.includes(order.state)) {
    return {
      eligible: false,
      reason: `Order is in state "${order.state}" — not eligible for return`
    };
  }

  // Nothing has shipped yet — there is no physical item for the customer
  // to send back. This is the real, dynamic commercetools shipmentState,
  // not an assumption based on order.state alone.
  if (!shipmentState || !SHIPPED_STATES.has(shipmentState)) {
    return {
      eligible: false,
      reason: shipmentState
        ? `Order shipment status is "${shipmentState}" — nothing has shipped yet, so there's nothing to return.`
        : "Order has no shipment status on record — nothing has shipped yet, so there's nothing to return.",
      shipmentState,
      paymentState
    };
  }

  // Payment must have actually cleared. An order that's unpaid, still
  // owes a balance, or failed payment can't be refunded via a return.
  if (paymentState !== "Paid") {
    return {
      eligible: false,
      reason: paymentState
        ? `Order payment status is "${paymentState}" — a return requires the order to be fully paid first.`
        : "Order has no payment status on record — a return requires the order to be fully paid first.",
      shipmentState,
      paymentState
    };
  }

  if (daysSince > returnWindowDays) {
    return {
      eligible: false,
      reason: `Order is ${daysSince} days old. Return window is ${returnWindowDays} days.`,
      daysSince,
      returnWindowDays,
      shipmentState,
      paymentState
    };
  }

  // Only judged when the caller fetched returnInfo — every unit already returned leaves nothing to return.
  if (order.returnInfo && order.lineItems?.length && [...returnableQuantities(order).values()].every((n) => n === 0)) {
    return {
      eligible: false,
      reason: "Every item on this order has already been returned.",
      shipmentState,
      paymentState
    };
  }

  return {
    eligible: true,
    daysSince,
    returnWindowDays,
    daysRemaining: returnWindowDays - daysSince,
    orderState: order.state,
    shipmentState,
    paymentState
  };
}

export const checkReturnEligibilityTool = tool({
  description:
    "Check whether an order is eligible for return based on its real order/payment/shipment state and age " +
    "(all pulled live from commercetools — never assume eligibility). An order can only be returned once it has " +
    "actually been paid for and actually shipped; a Pending/unpaid or Pending/unshipped order has nothing to " +
    "return yet. Returns the full order (with real lineItemIds) embedded in the result's `order` field, so " +
    "start_return can be prepared without a separate get_order call — and so the Return stepper panel has " +
    "something to render.",
  inputSchema: z.object({
    orderId: z.string().describe("Order ID to check"),
    likelyReason: z
      .string()
      .optional()
      .describe(
        "Return reason id ONLY when the conversation already says why the customer is returning " +
          "(e.g. 'arrived broken' → damaged_in_shipping, 'wrong size sent' → wrong_item). Ids: defective_product, " +
          "wrong_item, item_not_as_described, damaged_in_shipping, quality_issue. Empty string when nobody said why."
      ),
    likelyItems: z
      .array(z.string())
      .optional()
      .describe("Item names the rep or customer said are being returned (e.g. ['jacket']); empty array when they didn't say")
  }),
  execute: async ({ orderId, likelyReason, likelyItems }) => {
    try {
      const data = await bffQuery<{ order: CtOrderForReturn | null }>(
        `query OrderForReturn($id: ID) {
          order(id: $id) { ${ORDER_FIELDS} }
        }`,
        { id: orderId }
      );

      const order = data.order;
      if (!order) return { eligible: false, reason: "Order not found" };

      const eligibility = evaluateReturnEligibility(order);
      const returnReasons = RESOLUTION_REASONS.filter((r) => r.category === "return").map(({ id, label }) => ({ id, label }));
      return {
        ...eligibility,
        order: formatOrderForReturn(order),
        // The studio's return card offers these as its reason choices, with
        // the stated reason pre-selected (only a real id from the list).
        ...(eligibility.eligible
          ? {
              returnReasons,
              suggestedReason: returnReasons.some((r) => r.id === likelyReason) ? likelyReason : null,
              suggestedLineItemIds: matchLineItems(order, likelyItems ?? [])
            }
          : {})
      };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── update_order ─────────────────────────────────────────────────────────────

export const updateOrderTool = tool({
  description:
    "Apply a generic action to an order (e.g. add note, change state, set tracking). ALWAYS require action_approval for state changes. " +
    "commercetools' real GraphQL API models each action as { actionName: { ...params } } — e.g. " +
    '{ "changeOrderState": { "orderState": "Cancelled" } } or { "setOrderNumber": { "orderNumber": "..." } }. ' +
    'Do NOT use the REST-style { "action": "actionName", ...params } shape — it fails GraphQL validation outright.',
  inputSchema: z.object({
    orderId: z.string().describe("Order ID"),
    actions: z.array(z.record(z.unknown())).describe(
      'Array of commercetools order update actions, each shaped { actionName: { ...params } } — NOT { action: "actionName", ...params }'
    )
  }),
  execute: async ({ orderId, actions }) => {
    try {
      const data = await bffQuery<{ updateOrder: unknown }>(
        `mutation UpdateOrder($id: ID!, $actions: Json!) { updateOrder(id: $id, actions: $actions) }`,
        { id: orderId, actions }
      );
      return { success: true, result: data.updateOrder };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── list_regions ─────────────────────────────────────────────────────────────

/** Default regions used when neither env config nor BFF has project zones. */
const DEFAULT_REGIONS = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" }
];

export const listRegionsTool = tool({
  description:
    "List supported shipping regions (countries + currencies) for this project. Call before " +
    "create_cart when you don't know the project's currency — the first result is the default.",
  inputSchema: z.object({}),
  execute: async () => {
    // 1. Env-var override: CSA_REGIONS_JSON is a JSON array of { code, name, currency }
    //    Use this to configure project-specific regions without code changes.
    const envRegions = process.env.CSA_REGIONS_JSON?.trim();
    if (envRegions) {
      try {
        const parsed = JSON.parse(envRegions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as typeof DEFAULT_REGIONS;
        }
      } catch {
        log.child({ tool: "list_regions" }).warn("CSA_REGIONS_JSON is invalid JSON — falling back to defaults");
      }
    }

    // 2. Try BFF: query real shipping zones configured for this CT project.
    //    Zones define which countries the project supports. If the BFF doesn't
    //    expose a zones query yet, this falls through to the static defaults.
    try {
      const data = await bffQuery<{ zones: Array<{ name: string; locations: Array<{ country: string; state?: string }> }> }>(
        `query Zones { zones { name locations { country } } }`,
        {}
      );
      if (data?.zones?.length) {
        // Flatten to unique country codes — zones overlap, so deduplicate.
        const seen = new Set<string>();
        const regions: Array<{ code: string; name: string }> = [];
        for (const zone of data.zones) {
          for (const loc of zone.locations ?? []) {
            if (!seen.has(loc.country)) {
              seen.add(loc.country);
              regions.push({ code: loc.country, name: loc.country });
            }
          }
        }
        if (regions.length > 0) return regions;
      }
    } catch {
      // BFF zones not implemented yet — fall through to defaults
    }

    // 3. Static defaults — always works, covers the most common deployments.
    return DEFAULT_REGIONS;
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

export function buildCommerceTools(approvalGate?: { pending: boolean }) {
  return instrumentTools(guardWriteTools({
    find_customer: findCustomerTool,
    find_b2b_customer: findB2bCustomerTool,
    get_order: getOrderTool,
    get_latest_orders: getLatestOrdersTool,
    b2b_orders: b2bOrdersTool,
    view_cart: viewCartTool,
    b2b_carts: b2bCartsTool,
    search_products: searchProductsTool,
    list_products: listProductsTool,
    create_cart: createCartTool,
    add_to_cart: addToCartTool,
    remove_from_cart: removeFromCartTool,
    change_cart_quantity: changeCartQuantityTool,
    apply_discount_code: applyDiscountCodeTool,
    remove_discount_code: removeDiscountCodeTool,
    list_discount_codes: listDiscountCodesTool,
    delete_cart: deleteCartTool,
    update_cart_address: updateCartAddressTool,
    list_shipping_methods: listShippingMethodsTool,
    update_cart_shipping_method: updateCartShippingMethodTool,
    place_order: placeOrderTool,
    cancel_order: cancelOrderTool,
    start_return: startReturnTool,
    check_return_eligibility: checkReturnEligibilityTool,
    update_order: updateOrderTool,
    list_regions: listRegionsTool
  }, approvalGate), log);
}
