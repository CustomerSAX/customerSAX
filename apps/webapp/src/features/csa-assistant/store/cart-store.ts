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

/** Parse a currency symbol/code from an already-formatted price label like "$12.00" or "GBP 10.00" */
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
  unitPriceLabel?: string;
}

// ─── Totals shape ─────────────────────────────────────────────────────────────

export interface CartTotals {
  subtotalLabel: string | null;
  discountLabel: string | null;
  totalLabel: string | null;
  hasDiscount: boolean;
}

// ─── BFF response parsers ─────────────────────────────────────────────────────

interface RawLineItem {
  id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  sku?: string;
  variant?: { sku?: string };
  price?: { value?: MoneyValue };
}

interface RawCart {
  id?: string;
  cartState?: string;
  currency?: string;
  country?: string;
  totalPrice?: MoneyValue;
  lineItems?: RawLineItem[];
}

function parseLineItems(cart: RawCart | null): CartLineItem[] {
  const items = cart?.lineItems ?? [];
  return items
    .filter((li) => li.id)
    .map((li) => ({
      lineItemId: li.id as string,
      productId: li.productId,
      sku: li.sku ?? li.variant?.sku,
      name: li.name,
      quantity: li.quantity ?? 0,
      unitPriceLabel: formatMoney(li.price?.value),
    }));
}

function parseTotals(cart: RawCart | null): CartTotals {
  const money = cart?.totalPrice;
  const totalLabel = formatMoney(money) ?? null;
  if (!cart || money?.centAmount == null) {
    return { subtotalLabel: null, discountLabel: null, totalLabel, hasDiscount: false };
  }
  const fractionDigits = money.fractionDigits ?? 2;
  const currencyCode = money.currencyCode ?? 'USD';
  let subtotalCents = 0;
  for (const li of cart.lineItems ?? []) {
    const unit = li.price?.value?.centAmount ?? 0;
    subtotalCents += unit * (li.quantity ?? 0);
  }
  const discountCents = Math.max(0, subtotalCents - (money.centAmount ?? 0));
  return {
    subtotalLabel: formatMoney({ centAmount: subtotalCents, currencyCode, fractionDigits }) ?? null,
    discountLabel: discountCents > 0 ? (formatMoney({ centAmount: discountCents, currencyCode, fractionDigits }) ?? null) : null,
    totalLabel,
    hasDiscount: discountCents > 0,
  };
}

// ─── Cart action result ───────────────────────────────────────────────────────

export interface CartActionResult {
  ok: boolean;
  error?: string;
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
  currency: string | null;
  country: string | null;
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

  // ── Computed ──────────────────────────────────────────────────────────────
  /** Total number of individual units across all line items */
  get itemCount(): number;

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

const API_BASE = '';  // relative URLs; they resolve to /api/…

async function cartGet(id: string): Promise<RawCart> {
  const res = await fetch(`${API_BASE}/api/carts/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET /api/carts/${id}: HTTP ${res.status}`);
  return res.json() as Promise<RawCart>;
}

async function cartCreate(body: {
  currency: string;
  customerId?: string | null;
  customerEmail?: string | null;
}): Promise<RawCart> {
  const res = await fetch(`${API_BASE}/api/carts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /api/carts: HTTP ${res.status}`);
  const data = await res.json() as RawCart & { error?: string };
  if (data.error) throw new Error(data.error);
  return data;
}

async function cartUpdate(id: string, actions: Record<string, unknown>[]): Promise<RawCart> {
  const res = await fetch(`${API_BASE}/api/carts/${encodeURIComponent(id)}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ actions }),
  });
  if (!res.ok) throw new Error(`POST /api/carts/${id}/update: HTTP ${res.status}`);
  const data = await res.json() as RawCart & { error?: string };
  if (data.error) throw new Error(data.error);
  return data;
}

async function cartSearch(customerEmail: string): Promise<RawCart[]> {
  const res = await fetch(
    `${API_BASE}/api/carts?customerEmail=${encodeURIComponent(customerEmail)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json() as { results?: RawCart[] };
  return data.results ?? [];
}

function humanizeError(raw: string): string {
  if (raw.includes('price') && raw.includes('currency')) {
    return 'This product is not available in the cart\'s currency. Try a different product.';
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

export const useCartStore = create<CartState>((set, get) => ({
  customerId: null,
  customerEmail: null,
  cartId: null,
  currency: null,
  country: null,
  items: [],
  subtotalLabel: null,
  discountLabel: null,
  totalLabel: null,
  hasDiscount: false,
  resolving: false,
  mutating: false,
  pendingKeys: {},
  error: null,
  isCartOpen: false,

  get itemCount() {
    return get().items.reduce((n, i) => n + (i.quantity || 0), 0);
  },

  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),

  resolveForCustomer: async (customerId, customerEmail) => {
    const state = get();
    if (!customerId) {
      if (state.customerId !== null) {
        set({ customerId: null, customerEmail: null, cartId: null, items: [], currency: null, country: null, subtotalLabel: null, discountLabel: null, totalLabel: null, hasDiscount: false });
      }
      return;
    }
    if (state.customerId === customerId) return;

    set({ resolving: true, error: null, customerId, customerEmail: customerEmail ?? null, cartId: null, items: [], currency: null, country: null, subtotalLabel: null, discountLabel: null, totalLabel: null, hasDiscount: false });
    try {
      let activeCartId: string | null = null;
      if (customerEmail) {
        const carts = await cartSearch(customerEmail);
        const active = carts.find((c) => c.cartState === 'Active');
        activeCartId = active?.id ?? null;
      }
      if (activeCartId) {
        const cart = await cartGet(activeCartId);
        if (get().customerId !== customerId) return;
        set({
          cartId: activeCartId,
          items: parseLineItems(cart),
          ...parseTotals(cart),
          currency: cart.currency ?? null,
          country: cart.country ?? null,
          resolving: false,
        });
      } else {
        if (get().customerId !== customerId) return;
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
        const active = carts.find((c) => c.cartState === 'Active');
        activeCartId = active?.id ?? activeCartId;
      }
      if (!activeCartId) return;
      const cart = await cartGet(activeCartId);
      if (get().customerId !== customerId) return;
      set({
        cartId: activeCartId,
        items: parseLineItems(cart),
        ...parseTotals(cart),
        currency: cart.currency ?? get().currency,
        country: cart.country ?? get().country,
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
        set({ cartId: resolvedCartId, currency });
      }

      const action = sku
        ? { addLineItem: { sku, quantity: 1 } }
        : { addLineItem: { productId, variantId: variantId ?? 1, quantity: 1 } };

      await cartUpdate(resolvedCartId, [action]);
      const fresh = await cartGet(resolvedCartId);
      set({ items: parseLineItems(fresh), ...parseTotals(fresh), mutating: false, pendingKeys: clearPending(get, key) });
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
    const current = items.find((i) => i.lineItemId === lineItemId);
    if (!current) return { ok: false, error: 'Item not found in cart.' };
    const nextQty = current.quantity + delta;
    const key = itemKey(lineItemId);
    markPending(set, get, key);
    try {
      const action = nextQty <= 0
        ? { removeLineItem: { lineItemId } }
        : { changeLineItemQuantity: { lineItemId, quantity: nextQty } };
      await cartUpdate(cartId, [action]);
      const fresh = await cartGet(cartId);
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
    const { cartId } = get();
    if (!cartId) return { ok: false, error: 'No active cart.' };
    const key = itemKey(lineItemId);
    markPending(set, get, key);
    try {
      await cartUpdate(cartId, [{ removeLineItem: { lineItemId } }]);
      const fresh = await cartGet(cartId);
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
    subtotalLabel: null, discountLabel: null, totalLabel: null, hasDiscount: false,
    currency: null, country: null, error: null, pendingKeys: {}, isCartOpen: false,
  }),
}));
