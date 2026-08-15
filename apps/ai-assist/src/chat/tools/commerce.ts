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
import { contextStorage } from "../system-prompt.js";

const log = createLogger("ai-assist").child({ module: "tools/commerce" });

// ─── Fragments shared across tools ───────────────────────────────────────────

const MONEY_FRAGMENT = `centAmount currencyCode fractionDigits`;
const ORDER_FIELDS = `
  id orderNumber customerId state createdAt
  shipmentState paymentState
  totalPrice { ${MONEY_FRAGMENT} }
  lineItems { id productId sku name quantity totalPrice { ${MONEY_FRAGMENT} } }
`;
const CART_FIELDS = `
  id version key customerId currencyCode
  totalPrice { ${MONEY_FRAGMENT} }
  lineItems { id productId sku name quantity totalPrice { ${MONEY_FRAGMENT} } }
`;
const CUSTOMER_FIELDS = `
  id customerNumber email firstName lastName companyName
  customerGroup { id key name }
  version createdAt lastModifiedAt
`;
const PRODUCT_FIELDS = `id key sku name description slug imageUrl price { ${MONEY_FRAGMENT} }`;

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
        const data = await bffQuery<{ order: Record<string, unknown> | null }>(
          `query GetOrder($id: ID, $orderNumber: String) {
            order(id: $id, orderNumber: $orderNumber) { ${ORDER_FIELDS} }
          }`,
          { id: orderId, orderNumber }
        );
        if (data.order) {
          return { order: data.order, orders: [data.order], total: 1 };
        }
        return { order: null, orders: [], total: 0 };
      }

      if (customerId || customerEmail) {
        const data = await bffQuery<{ orderPage: { results: Record<string, unknown>[]; total: number } }>(
          `query CustomerOrders($customerId: ID, $customerEmail: String, $limit: Int) {
            orderPage(customerId: $customerId, customerEmail: $customerEmail, limit: $limit, sortKey: "createdAt", sortOrder: "desc") {
              results { ${ORDER_FIELDS} }
              total
            }
          }`,
          { customerId, customerEmail, limit }
        );
        const results = data.orderPage?.results ?? [];
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
      const data = await bffQuery<{ b2bOrders: { results: unknown[]; total: number } }>(
        `query B2BOrders($businessUnitKey: String, $customerId: ID, $limit: Int) {
          b2bOrders(businessUnitKey: $businessUnitKey, customerId: $customerId, limit: $limit, sortKey: "createdAt", sortOrder: "desc") {
            results { ${ORDER_FIELDS} }
            total
          }
        }`,
        { businessUnitKey, customerId, limit }
      );
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
        const data = await bffQuery<{ searchCarts: { results: unknown[]; total: number } }>(
          `query SearchCarts($text: String!, $limit: Int) {
            searchCarts(text: $text, limit: $limit) {
              results { ${CART_FIELDS} }
              total
            }
          }`,
          { text: searchText, limit: 5 }
        );
        return data.searchCarts;
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

// ─── search_products ──────────────────────────────────────────────────────────

export const searchProductsTool = tool({
  description: "Search the product catalog by name, SKU, or keyword.",
  inputSchema: z.object({
    query: z.string().describe("Search term (product name, SKU, keyword)"),
    limit: z.number().optional().default(8)
  }),
  execute: async ({ query, limit }) => {
    try {
      const data = await bffQuery<{ quickSearchProducts: unknown[] }>(
        `query QuickSearch($q: String!, $limit: Int) {
          quickSearchProducts(q: $q, limit: $limit) { ${PRODUCT_FIELDS} }
        }`,
        { q: query, limit }
      );
      return data.quickSearchProducts ?? [];
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── list_products ────────────────────────────────────────────────────────────

export const listProductsTool = tool({
  description: "Browse the product catalog with optional pagination.",
  inputSchema: z.object({
    limit: z.number().optional().default(10),
    offset: z.number().optional().default(0)
  }),
  execute: async ({ limit, offset }) => {
    try {
      const data = await bffQuery<{ productPage: { results: unknown[]; total: number } }>(
        `query ProductPage($limit: Int, $offset: Int) {
          productPage(limit: $limit, offset: $offset) {
            results { ${PRODUCT_FIELDS} }
            total
          }
        }`,
        { limit, offset }
      );
      return data.productPage;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── create_cart ──────────────────────────────────────────────────────────────

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
      .describe("B2B business unit key — omit for a normal order; never guess or reuse one from a different customer")
  }),
  execute: async ({ currency, customerId, customerEmail, businessUnitKey }) => {
    try {
      const data = await bffQuery<{ createB2bCart: unknown }>(
        `mutation CreateCart($currency: String!, $customerId: ID, $customerEmail: String, $businessUnitKey: String) {
          createB2bCart(currency: $currency, customerId: $customerId, customerEmail: $customerEmail, businessUnitKey: $businessUnitKey) {
            ${CART_FIELDS}
          }
        }`,
        { currency, customerId, customerEmail, businessUnitKey }
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
      return data.updateCartAddresses ?? { error: "Failed to set address" };
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
      return data.shippingMethods ?? [];
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
      return outcome.result;
    } catch (err) {
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
      return outcome.result ?? { error: "Order cancellation failed" };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── start_return ─────────────────────────────────────────────────────────────

export const startReturnTool = tool({
  description:
    "Start a return/refund process for specific line items. ALWAYS require action_approval before calling this tool.",
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
      return outcome.result ?? { error: "Return could not be started" };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── check_return_eligibility ─────────────────────────────────────────────────

type CtOrderForReturn = {
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
};

// commercetools' real ShipmentState enum. Only these two mean physical goods
// actually left the warehouse — everything else (Pending/Ready/Backorder/
// Delayed) means nothing has shipped yet, so there is nothing to return.
const SHIPPED_STATES = new Set(["Shipped", "Partial"]);

function formatOrderForReturn(order: CtOrderForReturn) {
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? undefined,
    totalPrice: formatMoney(order.totalPrice),
    lineItems: (order.lineItems ?? []).map((li) => ({
      lineItemId: li.id,
      name: li.name,
      quantity: li.quantity,
      sku: li.sku ?? undefined,
      price: formatMoney(li.totalPrice)
    }))
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
    orderId: z.string().describe("Order ID to check")
  }),
  execute: async ({ orderId }) => {
    try {
      const data = await bffQuery<{ order: CtOrderForReturn | null }>(
        `query OrderForReturn($id: ID) {
          order(id: $id) { ${ORDER_FIELDS} }
        }`,
        { id: orderId }
      );

      const order = data.order;
      if (!order) return { eligible: false, reason: "Order not found" };

      const orderDate = new Date(order.createdAt);
      const daysSince = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      const returnWindowDays = 30;
      const formattedOrder = formatOrderForReturn(order);
      const paymentState = order.paymentState ?? null;
      const shipmentState = order.shipmentState ?? null;

      const nonReturnableStates = ["Cancelled", "ReturnReceived"];
      if (nonReturnableStates.includes(order.state)) {
        return {
          eligible: false,
          reason: `Order is in state "${order.state}" — not eligible for return`,
          order: formattedOrder
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
          paymentState,
          order: formattedOrder
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
          paymentState,
          order: formattedOrder
        };
      }

      if (daysSince > returnWindowDays) {
        return {
          eligible: false,
          reason: `Order is ${daysSince} days old. Return window is ${returnWindowDays} days.`,
          daysSince,
          returnWindowDays,
          shipmentState,
          paymentState,
          order: formattedOrder
        };
      }

      return {
        eligible: true,
        daysSince,
        returnWindowDays,
        daysRemaining: returnWindowDays - daysSince,
        orderState: order.state,
        shipmentState,
        paymentState,
        order: formattedOrder
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

export function buildCommerceTools() {
  return {
    find_customer: findCustomerTool,
    find_b2b_customer: findB2bCustomerTool,
    get_order: getOrderTool,
    b2b_orders: b2bOrdersTool,
    view_cart: viewCartTool,
    b2b_carts: b2bCartsTool,
    search_products: searchProductsTool,
    list_products: listProductsTool,
    create_cart: createCartTool,
    add_to_cart: addToCartTool,
    remove_from_cart: removeFromCartTool,
    update_cart_address: updateCartAddressTool,
    list_shipping_methods: listShippingMethodsTool,
    update_cart_shipping_method: updateCartShippingMethodTool,
    place_order: placeOrderTool,
    cancel_order: cancelOrderTool,
    start_return: startReturnTool,
    check_return_eligibility: checkReturnEligibilityTool,
    update_order: updateOrderTool,
    list_regions: listRegionsTool
  };
}
