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

function humanizeError(raw: string): string {
  if (raw.includes('country')) return 'The address is missing a country — please provide one.';
  if (raw.includes('shipping')) return 'Unable to set shipping — please try a different method.';
  if (raw.includes('version')) return 'The cart was updated elsewhere — please refresh.';
  return raw.length > 120 ? 'Commerce backend error — please try again.' : raw;
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

async function apiSearchCustomer(term: string): Promise<{ id?: string; email?: string; firstName?: string; lastName?: string } | null> {
  const isEmail = term.includes('@');
  const res = await fetch(
    `/api/customers/search?${isEmail ? 'email' : 'name'}=${encodeURIComponent(term)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return null;
  const data = await res.json() as { customers?: Array<{ id?: string; email?: string; firstName?: string; lastName?: string }> };
  return data.customers?.[0] ?? null;
}

async function apiCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/addresses`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json() as { addresses?: CustomerAddress[] };
  return data.addresses ?? [];
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

  start: (cartId: string, customer: CheckoutCustomer | null) => void;
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
  'start' | 'confirmCustomer' | 'useSavedAddress' | 'useManualAddress' |
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

      // Clear cart state — the cart is now consumed.
      useCartStore.setState({
        cartId: null, items: [], subtotalLabel: null, discountLabel: null,
        totalLabel: null, hasDiscount: false,
      });

      set({
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
