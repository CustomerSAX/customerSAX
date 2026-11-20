"use client";

import { create } from 'zustand';
import { useCartStore } from './cart-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckoutStep = 'customer' | 'address' | 'shipping' | 'review' | 'done';

export interface CheckoutCustomer {
  id?: string;
  email?: string;
  name?: string;
}

export interface CustomerAddress {
  id?: string;
  key?: string;
  firstName?: string;
  lastName?: string;
  streetName?: string;
  streetNumber?: string;
  additionalStreetInfo?: string;
  city?: string;
  region?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ShippingMethodOption {
  id: string;
  name: string;
}

export interface CheckoutOrderResult {
  id: string;
  orderNumber?: string | null;
  total?: string | null;
  paid: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MoneyValue = { centAmount?: number; currencyCode?: string; fractionDigits?: number };

function formatMoney(value?: MoneyValue): string | null {
  if (value?.centAmount == null || !value.currencyCode) return null;
  const amount = (value.centAmount / 100).toFixed(value.fractionDigits ?? 2);
  const symbols: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' };
  return (symbols[value.currencyCode] ?? value.currencyCode + ' ') + amount;
}

/** Human-readable summary of an address for the review step. */
export function addressSummary(addr: CustomerAddress): string {
  return [
    [addr.streetNumber, addr.streetName].filter(Boolean).join(' '),
    addr.city,
    addr.state ?? addr.region,
    addr.postalCode,
    addr.country,
  ].filter(Boolean).join(', ');
}

/** Map a CustomerAddress to the CT address input shape (drops internal fields, no nulls). */
function addressToInput(addr: CustomerAddress): Record<string, unknown> | null {
  if (!addr.country) return null;
  const out: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) out[k] = s;
  };
  set('firstName', addr.firstName);
  set('lastName', addr.lastName);
  set('streetName', addr.streetName);
  set('streetNumber', addr.streetNumber);
  set('additionalStreetInfo', addr.additionalStreetInfo);
  set('city', addr.city);
  set('region', addr.region);
  set('state', addr.state);
  set('postalCode', addr.postalCode);
  set('country', addr.country);
  return out;
}

/**
 * Turns a commercetools/BFF error into a specific message for the rep. Each
 * rule matches what commercetools actually says, so the rep learns WHAT is
 * missing in the store setup instead of a generic "missing a country" (which
 * a tax error like "missing a tax rate for country 'NZ'" used to trigger).
 */
function humanizeError(raw: string): string {
  // Drop transport prefixes so only commercetools' own reason remains.
  const msg = raw
    .replace(/^(commercetools GraphQL failed:|GraphQL error:|BFF HTTP \d+:?)\s*/i, '')
    .trim();
  const country = msg.match(/country\s*['"`]?([A-Z]{2})\b/)?.[1] ?? msg.match(/['"`]([A-Z]{2})['"`]/)?.[1];
  const inCountry = country ? ` for ${country}` : ' for that country';

  if (/tax\s*rate|taxrate|tax category/i.test(msg)) {
    return `This store has no tax rate set up${inCountry}, so commercetools won't accept an address there. Add one in Merchant Center (Settings → Taxes) or use a country the store already taxes.`;
  }
  if (/country/i.test(msg) && /(not (?:be )?(?:defined|configured|supported|allowed)|project settings|is not one of)/i.test(msg)) {
    return `${country ?? 'That country'} isn't one of this store's countries — please pick one of the store's countries.`;
  }
  if (/(no|missing) (?:matching )?price|price .*not found|no price/i.test(msg)) {
    return `These items have no price${inCountry} in this cart's currency, so the address can't be used.`;
  }
  if (/shipping ?(?:zone|rate)|zone/i.test(msg)) {
    return `This store doesn't ship${inCountry} (no shipping zone or rate is set up). Use another country or add a zone in Merchant Center.`;
  }
  if (/country/i.test(msg) && /(missing|required|must be|empty)/i.test(msg) && !/tax|price|zone/i.test(msg)) {
    return 'The address is missing a country — please provide one.';
  }
  if (/shipping/i.test(msg)) return 'Unable to set shipping — please try a different method.';
  if (/version/i.test(msg)) return 'The cart was updated elsewhere — please refresh.';
  // Anything else: show commercetools' own reason (trimmed) rather than a generic line.
  return msg.length > 220 ? `${msg.slice(0, 217)}…` : msg || 'Commerce backend error — please try again.';
}

// ─── Cart/customer API helpers ────────────────────────────────────────────────

async function apiUpdateCart(cartId: string, actions: Record<string, unknown>[]): Promise<void> {
  const res = await fetch(`/api/carts/${encodeURIComponent(cartId)}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ actions }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Cart update HTTP ${res.status}`);
  }
}

async function apiGetCart(cartId: string): Promise<{ totalPrice?: MoneyValue; lineItems?: Array<{ quantity?: number }> }> {
  const res = await fetch(`/api/carts/${encodeURIComponent(cartId)}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Cart fetch HTTP ${res.status}`);
  return res.json();
}

async function apiPlaceOrder(cartId: string): Promise<{ id: string; orderNumber?: string | null; totalLabel?: string | null }> {
  const res = await fetch(`/api/carts/${encodeURIComponent(cartId)}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  const data = await res.json() as { id?: string; orderNumber?: string | null; totalLabel?: string | null; error?: string };
  if (!res.ok || !data.id) throw new Error(data.error ?? `Place order HTTP ${res.status}`);
  return { id: data.id, orderNumber: data.orderNumber ?? null, totalLabel: data.totalLabel ?? null };
}

async function apiSearchCustomer(term: string): Promise<{ id?: string; email?: string; name?: string; firstName?: string; lastName?: string } | null> {
  const res = await fetch(
    `/api/customers/search?query=${encodeURIComponent(term)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return null;
  const data = await res.json() as { results?: Array<{ id?: string; email?: string; name?: string; firstName?: string; lastName?: string }> };
  return data.results?.[0] ?? null;
}

async function apiCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/addresses`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json() as { addresses?: CustomerAddress[] | CustomerAddress };
  const raw = data.addresses;
  // Guard: the API must return an array — if it ever comes back as an object
  // (e.g. a mis-shaped resolver response) treat it as no saved addresses so
  // the manual-entry form renders instead of leaving the address step blank.
  return Array.isArray(raw) ? raw : [];
}

async function apiShippingMethods(): Promise<ShippingMethodOption[]> {
  const res = await fetch('/api/shipping-methods', { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json() as Array<{ id: string; name: string }>;
  return Array.isArray(data) ? data.map((m) => ({ id: m.id, name: m.name })) : [];
}

function totalsFromCart(cart: { totalPrice?: MoneyValue; lineItems?: Array<{ quantity?: number }> } | null) {
  const tp = cart?.totalPrice;
  return {
    totalLabel: formatMoney(tp),
    itemCount: (cart?.lineItems ?? []).reduce((n, li) => n + (li.quantity ?? 0), 0),
  };
}

// ─── Shared applyAddress helper ───────────────────────────────────────────────

async function applyAddress(
  cartId: string,
  address: Record<string, unknown>,
  summary: string,
  set: (partial: Partial<CheckoutState>) => void,
): Promise<boolean> {
  set({ busy: true, error: null });
  try {
    await apiUpdateCart(cartId, [
      { setShippingAddress: { address } },
      { setBillingAddress: { address } },
    ]);

    let methods: ShippingMethodOption[] = [];
    try { methods = await apiShippingMethods(); } catch { /* best-effort */ }

    const fresh = await apiGetCart(cartId);
    set({
      chosenAddressSummary: summary,
      shippingMethods: methods,
      step: 'shipping',
      busy: false,
      ...totalsFromCart(fresh),
    });
    return true;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error('[CheckoutStore] applyAddress failed:', raw);
    set({ busy: false, error: humanizeError(raw) });
    return false;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CheckoutState {
  isOpen: boolean;
  step: CheckoutStep;
  cartId: string | null;
  customer: CheckoutCustomer | null;
  addresses: CustomerAddress[];
  chosenAddressSummary: string | null;
  shippingMethods: ShippingMethodOption[];
  chosenShippingMethodId: string | null;
  chosenShippingMethodName: string | null;
  markPaid: boolean;
  totalLabel: string | null;
  itemCount: number;
  busy: boolean;
  error: string | null;
  order: CheckoutOrderResult | null;
  /** Carts an order was placed from in this session — their chat cards stay read-only. Survives reset(). */
  placedCartIds: string[];

  start: (cartId: string, customer: CheckoutCustomer | null) => void;
  /**
   * Open checkout for a cart shown in the chat (cart card Checkout button or the
   * assistant's start_checkout). Same flow as start(); totals are read from that
   * cart itself, since it may not be the cart the cart drawer is tracking.
   */
  startForCart: (cartId: string, customer: CheckoutCustomer | null) => void;
  confirmCustomer: (customer: CheckoutCustomer) => Promise<boolean>;
  useSavedAddress: (addr: CustomerAddress) => Promise<boolean>;
  useManualAddress: (addr: Record<string, unknown>, summary: string) => Promise<boolean>;
  chooseShippingMethod: (id: string) => Promise<boolean>;
  skipShipping: () => Promise<boolean>;
  setMarkPaid: (v: boolean) => void;
  placeOrder: () => Promise<boolean>;
  goTo: (step: CheckoutStep) => void;
  close: () => void;
  reset: () => void;
}

const INITIAL: Omit<CheckoutState,
  'placedCartIds' | 'start' | 'startForCart' | 'confirmCustomer' | 'useSavedAddress' | 'useManualAddress' |
  'chooseShippingMethod' | 'skipShipping' | 'setMarkPaid' | 'placeOrder' |
  'goTo' | 'close' | 'reset'
> = {
  isOpen: false,
  step: 'customer',
  cartId: null,
  customer: null,
  addresses: [],
  chosenAddressSummary: null,
  shippingMethods: [],
  chosenShippingMethodId: null,
  chosenShippingMethodName: null,
  markPaid: true,
  totalLabel: null,
  itemCount: 0,
  busy: false,
  error: null,
  order: null,
};

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  ...INITIAL,
  placedCartIds: [],

  startForCart: (cartId, customer) => {
    // Already open for this cart: keep the rep's progress instead of restarting.
    if (get().isOpen && get().cartId === cartId && get().step !== 'done') return;
    get().start(cartId, customer);
    void apiGetCart(cartId)
      .then((cart) => { if (get().cartId === cartId) set(totalsFromCart(cart)); })
      .catch(() => { /* keep the drawer totals already set by start() */ });
  },

  start: (cartId, customer) => {
    set({
      ...INITIAL,
      isOpen: true,
      step: 'customer',
      cartId,
      customer: customer ?? null,
      totalLabel: useCartStore.getState().totalLabel ?? null,
      itemCount: useCartStore.getState().items.reduce((n, i) => n + (i.quantity || 0), 0),
    });
  },

  confirmCustomer: async (customer) => {
    const cartId = get().cartId;
    if (!cartId) { set({ error: 'No active cart.' }); return false; }
    set({ busy: true, error: null });
    try {
      const resolved = { ...customer };

      // If no id yet, try to find the customer in CT by email/name.
      if (!resolved.id) {
        const term = (resolved.email || resolved.name || '').trim();
        if (term) {
          try {
            const match = await apiSearchCustomer(term);
            if (match?.id) {
              resolved.id = match.id;
              if (!resolved.email && match.email) resolved.email = match.email;
              if (!resolved.name && (match.firstName || match.lastName)) {
                resolved.name = [match.firstName, match.lastName].filter(Boolean).join(' ');
              }
            }
          } catch { /* fall through to guest */ }
        }
      }

      // Attach customer to cart.
      const actions: Record<string, unknown>[] = [];
      if (resolved.id) actions.push({ setCustomerId: { customerId: resolved.id } });
      if (resolved.email) actions.push({ setCustomerEmail: { email: resolved.email } });
      if (actions.length > 0) await apiUpdateCart(cartId, actions);

      // Load saved addresses for identified customers.
      let addresses: CustomerAddress[] = [];
      if (resolved.id) {
        try { addresses = await apiCustomerAddresses(resolved.id); } catch { addresses = []; }
      }

      set({ customer: resolved, addresses, step: 'address', busy: false });
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error('[CheckoutStore] confirmCustomer failed:', raw);
      set({ busy: false, error: humanizeError(raw) });
      return false;
    }
  },

  useSavedAddress: async (addr) => {
    const cartId = get().cartId;
    if (!cartId) return false;
    const input = addressToInput(addr);
    if (!input) {
      set({ error: 'This address is missing a country and cannot be used. Please enter one manually.' });
      return false;
    }
    return applyAddress(cartId, input, addressSummary(addr), set);
  },

  useManualAddress: async (addr, summary) => {
    const cartId = get().cartId;
    if (!cartId) return false;
    return applyAddress(cartId, addr, summary, set);
  },

  chooseShippingMethod: async (id) => {
    const cartId = get().cartId;
    if (!cartId) return false;
    const method = get().shippingMethods.find((m) => m.id === id) ?? null;
    set({ busy: true, error: null });
    try {
      await apiUpdateCart(cartId, [
        { setShippingMethod: { shippingMethod: { typeId: 'shipping-method', id } } },
      ]);
      const fresh = await apiGetCart(cartId);
      set({
        chosenShippingMethodId: id,
        chosenShippingMethodName: method?.name ?? null,
        step: 'review',
        busy: false,
        ...totalsFromCart(fresh),
      });
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error('[CheckoutStore] chooseShippingMethod failed:', raw);
      set({ busy: false, error: humanizeError(raw) });
      return false;
    }
  },

  skipShipping: async () => {
    const cartId = get().cartId;
    set({ busy: true, error: null });
    try {
      const fresh = cartId ? await apiGetCart(cartId) : null;
      set({ chosenShippingMethodId: null, chosenShippingMethodName: null, step: 'review', busy: false, ...totalsFromCart(fresh) });
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      set({ busy: false, error: humanizeError(raw) });
      return false;
    }
  },

  setMarkPaid: (v) => set({ markPaid: v }),

  placeOrder: async () => {
    const { cartId, markPaid, totalLabel } = get();
    if (!cartId) { set({ error: 'No active cart to place.' }); return false; }
    set({ busy: true, error: null });
    try {
      const result = await apiPlaceOrder(cartId);

      // Optionally mark the order as paid (offline payment).
      let paid = false;
      if (markPaid && result.id) {
        try {
          const res = await fetch(`/api/orders/${encodeURIComponent(result.id)}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ actions: [{ changePaymentState: { paymentState: 'Paid' } }] }),
          });
          paid = res.ok;
        } catch (e) {
          console.error('[CheckoutStore] mark-paid request failed:', e);
        }
      }

      // Clear cart state — the cart is now consumed. Only when it is the cart the
      // drawer tracks: a chat cart checked out here must not wipe a different one.
      if (useCartStore.getState().cartId === cartId) {
        useCartStore.setState({
          cartId: null, items: [], subtotalLabel: null, discountLabel: null,
          totalLabel: null, hasDiscount: false,
        });
      }

      set({
        placedCartIds: [...get().placedCartIds, cartId],
        order: {
          id: result.id,
          orderNumber: result.orderNumber ?? null,
          total: result.totalLabel ?? totalLabel,
          paid,
        },
        step: 'done',
        busy: false,
      });
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error('[CheckoutStore] placeOrder failed:', raw);
      set({ busy: false, error: humanizeError(raw) });
      return false;
    }
  },

  goTo: (step) => set({ step, error: null }),
  close: () => set({ isOpen: false }),
  reset: () => set({ ...INITIAL }),
}));
