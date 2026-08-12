"use client";

import { create } from 'zustand';

// ─── Money formatting ─────────────────────────────────────────────────────────

type MoneyValue = { centAmount?: number; currencyCode?: string; fractionDigits?: number };

function formatMoney(value?: MoneyValue): string | undefined {
  if (value?.centAmount == null || !value.currencyCode) return undefined;
  const amount = (value.centAmount / 100).toFixed(value.fractionDigits ?? 2);
  const symbols: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' };
  return (symbols[value.currencyCode] ?? value.currencyCode + ' ') + amount;
}

/** Parse a currency code from an already-formatted price label like "$12.00" or "GBP 10.00" */
function parseCurrencyFromLabel(label?: string): string | undefined {
  if (!label) return undefined;
  const symbolToCode: Record<string, string> = { '$': 'USD', '£': 'GBP', '€': 'EUR' };
  const m = label.trim().match(/^([A-Z]{3}|\$|£|€)/);
  if (!m) return undefined;
  return symbolToCode[m[1]] ?? m[1];
}

// ─── Line item shape ──────────────────────────────────────────────────────────

export interface CartLineItem {
  lineItemId: string;
  productId?: string;
  sku?: string;
  name?: string;
  quantity: number;
  /** Per-unit price label, derived from li.totalPrice / li.quantity */
  unitPriceLabel?: string;
}

// ─── Cart action result ───────────────────────────────────────────────────────

export interface CartActionResult {
  ok: boolean;
  error?: string;
}

// ─── BFF response parsers ─────────────────────────────────────────────────────
//
// These only reference fields that actually exist in the BFF's Cart / CartLineItem schema:
//
//   Cart:         id, version, key, customerId, currencyCode, totalPrice, lineItems
//   CartLineItem: id, productId, sku, name, quantity, totalPrice
//
// Fields that do NOT exist and must never be referenced:
//   cartState, country, currency (it's currencyCode), customerEmail,
//   shippingAddress, lineItems.variant, lineItems.price

interface RawLineItem {
  id?: string;
  productId?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  totalPrice?: MoneyValue;   // line total = unitPrice × quantity (already applied discounts)
}

interface RawCart {
  id?: string;
  customerId?: string;
  currencyCode?: string;     // NOT "currency" — the schema field is "currencyCode"
  totalPrice?: MoneyValue;
  lineItems?: RawLineItem[];
}

function parseLineItems(cart: RawCart | null): CartLineItem[] {
  return (cart?.lineItems ?? [])
    .filter((li) => li.id)
    .map((li) => ({
      lineItemId: li.id as string,
      productId: li.productId,
      sku: li.sku,
      name: li.name,
      quantity: li.quantity ?? 0,
      // Derive per-unit price from line total ÷ quantity
      unitPriceLabel:
        li.quantity && li.quantity > 0 && li.totalPrice?.centAmount != null
          ? formatMoney({
              centAmount: Math.round(li.totalPrice.centAmount / li.quantity),
              currencyCode: li.totalPrice.currencyCode,
              fractionDigits: li.totalPrice.fractionDigits,
            })
          : undefined,
    }));
}

function parseTotals(cart: RawCart | null): {
  subtotalLabel: string | null;
  discountLabel: string | null;
  totalLabel: string | null;
  hasDiscount: boolean;
} {
  // The BFF schema only exposes cart.totalPrice (the final CT total, post-discount).
  // We have no separate "gross price before discount" field, so we can't derive a
  // meaningful subtotal/discount split. Display total only.
  const totalLabel = formatMoney(cart?.totalPrice) ?? null;
  return { subtotalLabel: null, discountLabel: null, totalLabel, hasDiscount: false };
}

// ─── Pending-key helpers ──────────────────────────────────────────────────────

function addKey(input: { sku?: string; productId?: string }): string {
  return `add:${input.sku ?? input.productId ?? ''}`;
}
function itemKey(lineItemId: string): string {
  return `item:${lineItemId}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CartState {
  customerId: string | null;
  customerEmail: string | null;
  cartId: string | null;
  /** Cart currency code (e.g. "USD"), used when creating a new cart */
  currency: string | null;
  items: CartLineItem[];
  subtotalLabel: string | null;
  discountLabel: string | null;
  totalLabel: string | null;
  hasDiscount: boolean;
  resolving: boolean;
  mutating: boolean;
  pendingKeys: Record<string, boolean>;
  error: string | null;
  isCartOpen: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  openCart: () => void;
  closeCart: () => void;
  resolveForCustomer: (customerId: string | null, customerEmail: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  addItem: (input: {
    sku?: string;
    productId?: string;
    variantId?: number;
    name?: string;
    customerId?: string | null;
    priceLabel?: string;
  }) => Promise<CartActionResult>;
  changeQuantity: (lineItemId: string, delta: number) => Promise<CartActionResult>;
  removeItem: (lineItemId: string) => Promise<CartActionResult>;
  clear: () => void;
}

// ─── BFF call helpers (calls webapp's own API routes, never BFF directly) ────

/** Read the error message from a non-2xx response body, or fall back to a generic message. */
async function readErrorBody(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { error?: string };
    if (body.error) return body.error;
  } catch { /* ignore parse failures */ }
  return fallback;
}

async function cartGet(id: string): Promise<RawCart> {
  const res = await fetch(`/api/carts/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const msg = await readErrorBody(res, `Cart fetch failed (HTTP ${res.status})`);
    throw new Error(msg);
  }
  return res.json() as Promise<RawCart>;
}

async function cartCreate(body: {
  currency: string;
  customerId?: string | null;
  customerEmail?: string | null;
}): Promise<RawCart> {
  const res = await fetch('/api/carts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await readErrorBody(res, `Cart creation failed (HTTP ${res.status})`);
    throw new Error(msg);
  }
  const data = await res.json() as RawCart & { error?: string };
  if (data.error) throw new Error(data.error);
  return data;
}

async function cartUpdate(id: string, actions: Record<string, unknown>[]): Promise<RawCart> {
  const res = await fetch(`/api/carts/${encodeURIComponent(id)}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ actions }),
  });
  if (!res.ok) {
    const msg = await readErrorBody(res, `Cart update failed (HTTP ${res.status})`);
    throw new Error(msg);
  }
  const data = await res.json() as RawCart & { error?: string };
  if (data.error) throw new Error(data.error);
  return data;
}

async function cartSearch(customerEmail: string): Promise<RawCart[]> {
  const res = await fetch(
    `/api/carts?customerEmail=${encodeURIComponent(customerEmail)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json() as { results?: RawCart[] };
  return data.results ?? [];
}

function humanizeError(raw: string): string {
  if (raw.includes('price') && raw.includes('currency')) {
    return "This product is not available in the cart's currency. Try a different product.";
  }
  if (raw.includes('version')) {
    return 'The cart was updated elsewhere — please refresh and try again.';
  }
  return raw.length > 120 ? 'Commerce backend error — please try again.' : raw;
}

function markPending(
  set: (partial: Partial<CartState>) => void,
  get: () => CartState,
  key: string,
): void {
  set({ mutating: true, error: null, pendingKeys: { ...get().pendingKeys, [key]: true } });
}

function clearPending(get: () => CartState, key: string): Record<string, boolean> {
  const next = { ...get().pendingKeys };
  delete next[key];
  return next;
}

const EMPTY_TOTALS = {
  subtotalLabel: null as string | null,
  discountLabel: null as string | null,
  totalLabel: null as string | null,
  hasDiscount: false,
};

export const useCartStore = create<CartState>((set, get) => ({
  customerId: null,
  customerEmail: null,
  cartId: null,
  currency: null,
  items: [],
  ...EMPTY_TOTALS,
  resolving: false,
  mutating: false,
  pendingKeys: {},
  error: null,
  isCartOpen: false,

  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),

  resolveForCustomer: async (customerId, customerEmail) => {
    const state = get();
    if (!customerId) {
      if (state.customerId !== null) {
        set({
          customerId: null, customerEmail: null, cartId: null,
          items: [], currency: null, ...EMPTY_TOTALS,
        });
      }
      return;
    }
    if (state.customerId === customerId) return;

    set({
      resolving: true, error: null,
      customerId, customerEmail: customerEmail ?? null,
      cartId: null, items: [], currency: null, ...EMPTY_TOTALS,
    });

    try {
      let activeCartId: string | null = null;
      if (customerEmail) {
        const carts = await cartSearch(customerEmail);
        // cartState is not exposed in the BFF schema; take the most recent result
        // (searchCarts typically returns active carts first from CT).
        activeCartId = carts[0]?.id ?? null;
      }

      if (get().customerId !== customerId) return; // stale

      if (activeCartId) {
        const cart = await cartGet(activeCartId);
        if (get().customerId !== customerId) return; // stale
        set({
          cartId: activeCartId,
          items: parseLineItems(cart),
          ...parseTotals(cart),
          // cart.currencyCode is the correct field name; store it as "currency" internally
          currency: cart.currencyCode ?? null,
          resolving: false,
        });
      } else {
        set({ resolving: false });
      }
    } catch (e) {
      if (get().customerId !== customerId) return;
      console.error('[CartStore] resolve failed:', e);
      set({ resolving: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  refresh: async () => {
    const { customerId, customerEmail, cartId } = get();
    if (!customerId) return;
    try {
      let activeCartId = cartId;
      if (customerEmail) {
        const carts = await cartSearch(customerEmail);
        activeCartId = carts[0]?.id ?? activeCartId;
      }
      if (!activeCartId) return;
      const cart = await cartGet(activeCartId);
      if (get().customerId !== customerId) return;
      set({
        cartId: activeCartId,
        items: parseLineItems(cart),
        ...parseTotals(cart),
        currency: cart.currencyCode ?? get().currency,
      });
    } catch (e) {
      console.error('[CartStore] refresh failed:', e);
    }
  },

  addItem: async ({ sku, productId, variantId, customerId, priceLabel }) => {
    const key = addKey({ sku, productId });
    markPending(set, get, key);
    try {
      const existing = get();
      let resolvedCartId: string;
      let currency = existing.currency;

      if (existing.cartId) {
        resolvedCartId = existing.cartId;
      } else {
        // Infer currency from the item's price label; fall back to USD.
        const itemCurrency = parseCurrencyFromLabel(priceLabel);
        currency = currency ?? itemCurrency ?? 'USD';
        const draft: { currency: string; customerId?: string | null; customerEmail?: string | null } = { currency };
        if (customerId) draft.customerId = customerId;
        if (existing.customerEmail) draft.customerEmail = existing.customerEmail;
        const created = await cartCreate(draft);
        if (!created.id) throw new Error('Cart creation returned no id.');
        resolvedCartId = created.id;
        set({ cartId: resolvedCartId, currency: created.currencyCode ?? currency });
      }

      const action = sku
        ? { addLineItem: { sku, quantity: 1 } }
        : { addLineItem: { productId, variantId: variantId ?? 1, quantity: 1 } };

      const fresh = await cartUpdate(resolvedCartId, [action]);
      set({
        items: parseLineItems(fresh),
        ...parseTotals(fresh),
        mutating: false,
        pendingKeys: clearPending(get, key),
      });
      return { ok: true };
    } catch (e) {
      const msg = humanizeError(e instanceof Error ? e.message : String(e));
      console.error('[CartStore] addItem failed:', e);
      set({ mutating: false, error: msg, pendingKeys: clearPending(get, key) });
      return { ok: false, error: msg };
    }
  },

  changeQuantity: async (lineItemId, delta) => {
    const { cartId, items } = get();
    if (!cartId) return { ok: false, error: 'No active cart.' };
    const current = items.find((i) => i.lineItemId === lineItemId || (i.sku && i.sku === lineItemId));
    if (!current) return { ok: false, error: 'Item not found in cart.' };
    const nextQty = current.quantity + delta;
    const key = itemKey(current.lineItemId);
    markPending(set, get, key);
    try {
      const action = nextQty <= 0
        ? { removeLineItem: { lineItemId: current.lineItemId } }
        : { changeLineItemQuantity: { lineItemId: current.lineItemId, quantity: nextQty } };
      const fresh = await cartUpdate(cartId, [action]);
      set({ items: parseLineItems(fresh), ...parseTotals(fresh), mutating: false, pendingKeys: clearPending(get, key) });
      return { ok: true };
    } catch (e) {
      const msg = humanizeError(e instanceof Error ? e.message : String(e));
      console.error('[CartStore] changeQuantity failed:', e);
      set({ mutating: false, error: msg, pendingKeys: clearPending(get, key) });
      return { ok: false, error: msg };
    }
  },

  removeItem: async (lineItemId) => {
    const { cartId, items } = get();
    if (!cartId) return { ok: false, error: 'No active cart.' };
    const current = items.find((i) => i.lineItemId === lineItemId || (i.sku && i.sku === lineItemId));
    const targetId = current?.lineItemId ?? lineItemId;
    const key = itemKey(targetId);
    markPending(set, get, key);
    try {
      const fresh = await cartUpdate(cartId, [{ removeLineItem: { lineItemId: targetId } }]);
      set({ items: parseLineItems(fresh), ...parseTotals(fresh), mutating: false, pendingKeys: clearPending(get, key) });
      return { ok: true };
    } catch (e) {
      const msg = humanizeError(e instanceof Error ? e.message : String(e));
      console.error('[CartStore] removeItem failed:', e);
      set({ mutating: false, error: msg, pendingKeys: clearPending(get, key) });
      return { ok: false, error: msg };
    }
  },

  clear: () => set({
    customerId: null, customerEmail: null, cartId: null, items: [],
    ...EMPTY_TOTALS, currency: null, error: null, pendingKeys: {}, isCartOpen: false,
  }),
}));
