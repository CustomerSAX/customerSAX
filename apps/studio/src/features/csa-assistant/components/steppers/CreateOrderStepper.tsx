'use client';

import { useState, useEffect } from 'react';
import { Button, Checkbox, Input, Select } from '@csa/ui';
import './stepper.css';
import type { OrderWorkflowSnapshot } from '../../store/conversation-store';
import {
  CustomerResultList,
  StepperHeader,
  SuccessBox,
  PendingApprovalNote,
  type CustomerSearchResult,
} from './stepper-shared';

// The three regions this project actually serves (mirrors list_regions — see
// lib/ai/system-prompt.ts). CommerceTools' Address.country field requires an
// ISO 3166-1 alpha-2 code, not a free-typed country name, so this is a fixed
// picker rather than a text input — a rep typing "United States" instead of
// "US" is exactly what was breaking ct_update_cart's setBillingAddress /
// setShippingAddress actions.
export const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
];

const STEP_ORDER = ['customer', 'items', 'discount', 'address', 'shipping', 'review', 'done'];

/**
 * Local draft fields mirrored for the review step's display. Billing/shipping
 * address and shipMethod are submitted for real via onAction (order.set_address,
 * order.set_shipping_method) and set on the cart by the assistant — these local
 * copies exist only so the review step can render them without waiting on a
 * round trip. discount remains cosmetic-only: no MCP-backed capability exists
 * for it (a documented gap — see the roadmap's M-3), so it's surfaced to the
 * rep as a note only, never silently baked into a total the assistant never
 * actually charged.
 */
export interface LocalOrderDraft {
  discount: { type: 'none' | 'percent' | 'fixed'; value: number };
  billing: { name: string; street: string; city: string; postal: string; country: string };
  shipping: { name: string; street: string; city: string; postal: string; country: string };
  sameAsBilling: boolean;
  shipMethod: string | null;
}

export const EMPTY_LOCAL_ORDER_DRAFT: LocalOrderDraft = {
  discount: { type: 'none', value: 0 },
  billing: { name: '', street: '', city: '', postal: '', country: 'US' },
  shipping: { name: '', street: '', city: '', postal: '', country: 'US' },
  sameAsBilling: true,
  shipMethod: null,
};

interface CreateOrderStepperProps {
  step: string;
  setStep: (s: string) => void;
  /** Read-only, derived from the assistant's own tool-call stream — see OrderWorkflowSnapshot. */
  workflow: OrderWorkflowSnapshot | null;
  /** Cosmetic-only fields with no MCP capability behind them yet (discount, shipping method, address form-in-progress). */
  localDraft: LocalOrderDraft;
  setLocalDraft: (updater: (prev: LocalOrderDraft) => LocalOrderDraft) => void;
  /** Submits a structured workflow action through the real conversation — the assistant executes it, never this component. */
  onAction: (action: Record<string, unknown>) => void;
  /** True while the assistant is generating a reply — used to show a visible "working on it" state instead of going silent between a click and the result. */
  isLoading: boolean;
  onClose: () => void;
}

export function CreateOrderStepper({
  step,
  setStep,
  workflow,
  localDraft,
  setLocalDraft,
  onAction,
  isLoading,
  onClose,
}: CreateOrderStepperProps) {
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Array<{ sku: string; name: string; price: number; stock: number }>>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [shipMethods, setShipMethods] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingShipMethods, setIsLoadingShipMethods] = useState(false);

  // The project's real shipping methods — same read-only BFF endpoint the order
  // detail Shipping tab already uses. A one-time fetch (the list is small and
  // project-wide, not search-driven) so the picker offers real ids the
  // assistant can actually set on the cart, not the old made-up standard/
  // express/overnight options.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setIsLoadingShipMethods(true));
    fetch('/api/shipping-methods')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setShipMethods(Array.isArray(data) ? data : []);
      })
      .catch((e) => console.error('Shipping methods fetch failed:', e))
      .finally(() => {
        if (!cancelled) setIsLoadingShipMethods(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Debounced product search — same treatment: a read-only browse, not a
  // business decision. Adding an item is the decision, and that goes through
  // onAction.
  useEffect(() => {
    const trimmed = productSearch.trim();
    if (trimmed.length < 3) {
      queueMicrotask(() => setSearchedProducts([]));
      return;
    }

    queueMicrotask(() => setIsSearchingProducts(true));
    const timer = setTimeout(async () => {
      try {
        const hits = await fetch('/api/product-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, limit: 12, offset: 0 })
        });
        if (hits.ok) {
          const data = (await hits.json()) as {
            results?: Array<{
              id?: string;
              key?: string;
              sku?: string;
              name?: string;
              price?: number | string;
              inStock?: boolean;
              masterData?: {
                current?: {
                  nameAllLocales?: Array<{ locale?: string; value?: string }>;
                  allVariants?: Array<{ sku?: string }>;
                  masterVariant?: {
                    sku?: string;
                    prices?: Array<{ value?: { centAmount?: number; fractionDigits?: number } }>;
                  };
                };
              };
              nameAllLocales?: Array<{ locale?: string; value?: string }>;
            }>;
          };
          // /api/product-search returns a flat shape ({id, sku, name, price
          // as a formatted "$X.XX" string, inStock}), not a raw commercetools
          // product projection ({masterVariant, variants: [...]}) — the old
          // parsing here always iterated an empty variants array and silently
          // dropped every real result, showing "No products found" even when
          // the API genuinely had matches.
          const results = (data.results || [])
            .map((p) => {
              const current = p.masterData?.current;
              const masterVariant = current?.masterVariant;

              const sku =
                (typeof p.sku === 'string' && p.sku.trim()) ||
                (typeof masterVariant?.sku === 'string' && masterVariant.sku.trim()) ||
                (typeof current?.allVariants?.[0]?.sku === 'string' && current.allVariants[0].sku.trim()) ||
                (typeof p.key === 'string' && p.key.trim()) ||
                (typeof p.id === 'string' && p.id.trim()) ||
                '';

              const rawNameLocales = current?.nameAllLocales ?? p.nameAllLocales;
              const localeName = Array.isArray(rawNameLocales)
                ? (rawNameLocales.find((l) => l.locale === 'en')?.value || rawNameLocales[0]?.value)
                : '';
              const name = p.name ? String(p.name) : (localeName || sku || '');

              let numericPrice = 0;
              if (typeof p.price === 'number') {
                numericPrice = p.price;
              } else if (masterVariant?.prices?.[0]?.value) {
                const val = masterVariant.prices[0].value;
                const fractionDigits = typeof val.fractionDigits === 'number' ? val.fractionDigits : 2;
                numericPrice = (val.centAmount || 0) / 10 ** fractionDigits;
              } else if (p.price) {
                numericPrice = parseFloat(String(p.price).replace(/[^0-9.]/g, '')) || 0;
              }

              return {
                sku,
                name,
                price: numericPrice,
                stock: p.inStock === false ? 0 : 99
              };
            })
            .filter((p: { sku: string }) => p.sku);
          setSearchedProducts(results);
        }
      } catch (e) {
        console.error('Dynamic product search failed:', e);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [productSearch]);

  // ── Auto-advance the visual step to match the assistant's actual progress ──
  // The stepper never decides "the customer is resolved" or "the order is
  // placed" itself — it just reflects what the workflow snapshot (built from
  // the assistant's own tool calls) already says happened.
  useEffect(() => {
    if (workflow?.customer?.id && step === 'customer') setStep('items');
  }, [workflow?.customer?.id, step, setStep]);

  useEffect(() => {
    if (workflow?.placedOrder && step !== 'done') setStep('done');
  }, [workflow?.placedOrder, step, setStep]);

  const cartItems = workflow?.cart?.items ?? [];
  const cartHasItem = (sku: string) => cartItems.some((it) => it.sku === sku);

  const money = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const selectCustomer = (c: CustomerSearchResult) => {
    onAction({ type: 'order.select_customer', customerId: c.id, name: c.name, email: c.email });
  };

  const changeQty = (sku: string, delta: number) => {
    const currentDraft = qtyDraft[sku] || 1;
    setQtyDraft(prev => ({ ...prev, [sku]: Math.max(1, currentDraft + delta) }));
  };

  const addToCart = (sku: string, name: string) => {
    const quantity = qtyDraft[sku] || 1;
    onAction({ type: 'order.add_item', sku, name, quantity });
    setQtyDraft(prev => ({ ...prev, [sku]: 1 }));
  };

  const removeFromCart = (sku: string) => {
    onAction({ type: 'order.remove_item', sku });
  };

  const continueToDiscount = () => setStep('discount');

  const continueToAddress = () => setStep('address');

  const updateField = (group: 'billing' | 'shipping', field: string, value: string) => {
    setLocalDraft((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } }));
  };

  const countryName = (code: string) => COUNTRIES.find(c => c.code === code)?.name || code;

  const toggleSameAsBilling = () => {
    setLocalDraft((prev) => ({ ...prev, sameAsBilling: !prev.sameAsBilling }));
  };

  const continueToShipping = () => {
    onAction({
      type: 'order.set_address',
      billing: localDraft.billing,
      shipping: localDraft.sameAsBilling ? null : localDraft.shipping,
      sameAsBilling: localDraft.sameAsBilling,
    });
    setStep('shipping');
  };

  const selectShipMethod = (id: string) => {
    const method = shipMethods.find((m) => m.id === id);
    setLocalDraft((prev) => ({ ...prev, shipMethod: id }));
    onAction({ type: 'order.set_shipping_method', id, name: method?.name });
    setStep('review');
  };

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const requestPaymentReminder = () => {
    onAction({ type: 'order.request_payment_reminder' });
  };

  const placeOrder = () => {
    setIsPlacingOrder(true);
    onAction({ type: 'order.place' });
    // isPlacingOrder is cleared once the assistant either places the order
    // (workflow.placedOrder appears — the auto-advance effect above moves us
    // to 'done') or the rep navigates away; there is no local "success" to
    // fabricate here.
  };

  useEffect(() => {
    if (workflow?.placedOrder) queueMicrotask(() => setIsPlacingOrder(false));
  }, [workflow?.placedOrder]);

  // Safety net: if the AI stream ends (isLoading → false) while we're still
  // waiting for a placed order, the stream must have failed — unlock the button
  // so the rep can retry instead of being stuck with a permanently disabled CTA.
  useEffect(() => {
    if (!isLoading && isPlacingOrder && !workflow?.placedOrder) {
      queueMicrotask(() => setIsPlacingOrder(false));
    }
  }, [isLoading, isPlacingOrder, workflow?.placedOrder]);

  const startNew = () => {
    setLocalDraft(() => ({ ...EMPTY_LOCAL_ORDER_DRAFT }));
    setStep('customer');
    onAction({ type: 'order.start_new' });
  };

  // Header helpers
  const getHeaderDetails = () => {
    switch (step) {
      case 'customer':
        return { eyebrow: 'Step 1 of 6', title: 'Who is this order for?', sub: 'Search for a customer to start a cart.' };
      case 'items':
        return { eyebrow: 'Step 2 of 6', title: 'Add items to the cart', sub: `Cart for ${workflow?.customer?.name || 'this customer'}. Add or remove items below.` };
      case 'discount':
        return { eyebrow: 'Step 3 of 6', title: 'Note a discount?', sub: "Optional — note it here if you're offering the customer a discount; you'll apply it with them directly." };
      case 'address':
        return { eyebrow: 'Step 4 of 6', title: 'Billing & shipping address', sub: 'Same address works for most orders — toggle off if shipping differs.' };
      case 'shipping':
        return { eyebrow: 'Step 5 of 6', title: 'Choose a shipping method', sub: "Pick what you and the customer agreed on — this sets it on the order." };
      case 'review':
        return { eyebrow: 'Step 6 of 6', title: 'Review & place order', sub: 'Last check before this becomes a real order.' };
      case 'done':
      default:
        return { eyebrow: 'Done', title: 'Order placed', sub: '' };
    }
  };

  const header = getHeaderDetails();

  return (
    <div className="create-order-stepper-container">
      {/* Header */}
      <StepperHeader
        stepDots={{
          steps: STEP_ORDER,
          visibleCount: 6,
          currentStep: step,
          activeColor: 'var(--color-primary)',
          doneColor: 'var(--color-success)',
          isStepClickable: (i) => i === 0 || !!workflow?.customer,
          onStepClick: setStep,
        }}
        eyebrow={header.eyebrow}
        title={header.title}
        sub={header.sub}
        onClose={onClose}
        closeTitle="Close order flow"
      />

      {/* Body */}
      <div className="options-body">
        {step === 'customer' && (
          <>
            <CustomerResultList
              search={customerSearch}
              setSearch={setCustomerSearch}
              onSelect={selectCustomer}
              placeholder="Search customers by name or email..."
              autoFocus
              emptyBeforeTyping="Type a name or email to start adding items..."
            />

            {isLoading && (
              <div style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                Confirming this customer…
              </div>
            )}
          </>
        )}

        {step === 'items' && (
          <>
            <div className="opt-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Input
                className="search-input"
                placeholder="Search products by name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
            <div className="product-grid">
              {productSearch.trim() === '' ? (
                <div style={{ padding: '16px', color: 'var(--color-text-muted)', textAlign: 'center', gridColumn: '1 / -1', fontSize: '13px' }}>
                  Type a product name or SKU in the search bar above to start adding items...
                </div>
              ) : isSearchingProducts ? (
                <div style={{ padding: '16px', color: 'var(--color-text-muted)', textAlign: 'center', gridColumn: '1 / -1', fontSize: '13px' }}>
                  Searching products...
                </div>
              ) : searchedProducts.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--color-text-muted)', textAlign: 'center', gridColumn: '1 / -1', fontSize: '13px' }}>
                  No products found matching &quot;{productSearch}&quot;.
                </div>
              ) : (
                searchedProducts.map(p => {
                  const q = qtyDraft[p.sku] || 1;
                  const inCart = cartHasItem(p.sku);
                  let stockLabel;
                  if (p.stock === 0) {
                    stockLabel = <span className="stock-badge out">Out of stock</span>;
                  } else if (p.stock < 10) {
                    stockLabel = <span className="stock-badge low">Low stock</span>;
                  } else {
                    stockLabel = <span className="stock-badge in">In stock</span>;
                  }

                  return (
                    <div key={p.sku} className="product-card">
                      <div className="product-name">{p.name}</div>
                      <div className="product-meta">{p.sku}</div>
                      <div className="product-price">{money(p.price)}</div>
                      {stockLabel}
                      <div className="qty-row">
                        <Button className="qty-btn hover:translate-y-0" variant="secondary" size="sm" onClick={() => changeQty(p.sku, -1)} disabled={p.stock <= 0}>−</Button>
                        <span className="qty-val">{q}</span>
                        <Button className="qty-btn hover:translate-y-0" variant="secondary" size="sm" onClick={() => changeQty(p.sku, 1)} disabled={p.stock <= 0}>+</Button>
                        <Button className="add-btn hover:translate-y-0" variant="primary" size="sm" onClick={() => addToCart(p.sku, p.name)} disabled={p.stock <= 0}>
                          {inCart ? 'Add more' : 'Add to Cart'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="cart-box">
              <div className="cart-title">Cart</div>
              {cartItems.length === 0 ? (
                <div className="cart-empty">No items yet</div>
              ) : (
                cartItems.map((it) => (
                  <div key={it.sku} className="cart-row">
                    <span className="name">{it.name} &times; {it.quantity}</span>
                    <span>{it.price || ''}</span>
                    <span className="cart-remove" onClick={() => removeFromCart(it.sku!)}>Remove</span>
                  </div>
                ))
              )}
              {workflow?.cart?.total && (
                <div className="cart-summary-row total">
                  <span>Total</span>
                  <span>{workflow.cart.total}</span>
                </div>
              )}
            </div>
            <PendingApprovalNote pendingApproval={workflow?.pendingApproval} isLoading={isLoading} />
          </>
        )}

        {step === 'discount' && (
          <>
            <div className="discount-grid">
              <div
                className={`discount-card ${localDraft.discount.type === 'none' ? 'active-choice' : ''}`}
                onClick={() => setLocalDraft((prev) => ({ ...prev, discount: { type: 'none', value: 0 } }))}
              >
                <div className="row">
                  <b style={{ fontSize: '13px' }}>No discount</b>
                  {localDraft.discount.type === 'none' && '✓'}
                </div>
              </div>
              <div
                className={`discount-card ${localDraft.discount.type === 'percent' ? 'active-choice' : ''}`}
                onClick={() => setLocalDraft((prev) => ({ ...prev, discount: { ...prev.discount, type: 'percent' } }))}
              >
                <div className="row">
                  <b style={{ fontSize: '13px' }}>Percentage off</b>
                  {localDraft.discount.type === 'percent' && '✓'}
                </div>
                {localDraft.discount.type === 'percent' && (
                  <Input
                    className="discount-input"
                    type="number"
                    placeholder="%"
                    value={localDraft.discount.value || ''}
                    onChange={(e) => setLocalDraft((prev) => ({ ...prev, discount: { ...prev.discount, value: parseFloat(e.target.value) || 0 } }))}
                  />
                )}
              </div>
              <div
                className={`discount-card ${localDraft.discount.type === 'fixed' ? 'active-choice' : ''}`}
                onClick={() => setLocalDraft((prev) => ({ ...prev, discount: { ...prev.discount, type: 'fixed' } }))}
              >
                <div className="row">
                  <b style={{ fontSize: '13px' }}>Fixed amount off</b>
                  {localDraft.discount.type === 'fixed' && '✓'}
                </div>
                {localDraft.discount.type === 'fixed' && (
                  <Input
                    className="discount-input"
                    type="number"
                    placeholder="$"
                    value={localDraft.discount.value || ''}
                    onChange={(e) => setLocalDraft((prev) => ({ ...prev, discount: { ...prev.discount, value: parseFloat(e.target.value) || 0 } }))}
                  />
                )}
              </div>
            </div>
            <div className="options-sub" style={{ marginTop: '8px' }}>
              This won&apos;t change the order total automatically — let the customer know directly, and it&apos;ll be saved to the ticket for the record.
            </div>
          </>
        )}

        {step === 'address' && (
          <>
            <div className="addr-section-title">Billing address</div>
            <div className="form-grid">
              <div>
                <label className="field-label">Full name</label>
                <Input onChange={(e) => updateField('billing', 'name', e.target.value)} value={localDraft.billing.name} />
              </div>
              <div>
                <label className="field-label">Country</label>
                <Select onChange={(e) => updateField('billing', 'country', e.target.value)} value={localDraft.billing.country}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="form-grid">
              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Street address</label>
                <Input onChange={(e) => updateField('billing', 'street', e.target.value)} value={localDraft.billing.street} />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label className="field-label">City</label>
                <Input onChange={(e) => updateField('billing', 'city', e.target.value)} value={localDraft.billing.city} />
              </div>
              <div>
                <label className="field-label">Postal code</label>
                <Input onChange={(e) => updateField('billing', 'postal', e.target.value)} value={localDraft.billing.postal} />
              </div>
            </div>

            <div className="toggle-row" onClick={toggleSameAsBilling}>
              <Checkbox checked={localDraft.sameAsBilling} readOnly size="sm" />
              Shipping address is the same as billing
            </div>

            {!localDraft.sameAsBilling && (
              <>
                <div className="addr-section-title">Shipping address</div>
                <div className="form-grid">
                  <div>
                    <label className="field-label">Full name</label>
                    <Input onChange={(e) => updateField('shipping', 'name', e.target.value)} value={localDraft.shipping.name} />
                  </div>
                  <div>
                    <label className="field-label">Country</label>
                    <Select onChange={(e) => updateField('shipping', 'country', e.target.value)} value={localDraft.shipping.country}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="form-grid">
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="field-label">Street address</label>
                    <Input onChange={(e) => updateField('shipping', 'street', e.target.value)} value={localDraft.shipping.street} />
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="field-label">City</label>
                    <Input onChange={(e) => updateField('shipping', 'city', e.target.value)} value={localDraft.shipping.city} />
                  </div>
                  <div>
                    <label className="field-label">Postal code</label>
                    <Input onChange={(e) => updateField('shipping', 'postal', e.target.value)} value={localDraft.shipping.postal} />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 'shipping' && (
          <>
            {isLoadingShipMethods && <div className="options-sub">Loading shipping methods…</div>}
            {!isLoadingShipMethods && shipMethods.length === 0 && (
              <div className="options-sub">No shipping methods are set up for this store yet — you can skip this and place the order without one.</div>
            )}
            {shipMethods.map(m => (
              <div
                key={m.id}
                className={`method-card ${localDraft.shipMethod === m.id ? 'selected' : ''}`}
                onClick={() => selectShipMethod(m.id)}
              >
                <div className="method-radio" />
                <div className="opt-main">
                  <div className="opt-name">{m.name}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {step === 'review' && (
          <>
            <div className="summary-card">
              <div className="summary-head">
                <b>{workflow?.customer?.name || 'Customer'}</b>
                <div className="addr-cols">
                  <div>
                    <b style={{ color: 'var(--color-ink)' }}>Billing</b>
                    <br />
                    {localDraft.billing.name}<br />
                    {localDraft.billing.street}<br />
                    {localDraft.billing.city} {localDraft.billing.postal}<br />
                    {countryName(localDraft.billing.country)}
                  </div>
                  <div>
                    <b style={{ color: 'var(--color-ink)' }}>Shipping</b>
                    <br />
                    {localDraft.sameAsBilling ? (
                      <>
                        {localDraft.billing.name}<br />
                        {localDraft.billing.street}<br />
                        {localDraft.billing.city} {localDraft.billing.postal}<br />
                        {countryName(localDraft.billing.country)}
                      </>
                    ) : (
                      <>
                        {localDraft.shipping.name}<br />
                        {localDraft.shipping.street}<br />
                        {localDraft.shipping.city} {localDraft.shipping.postal}<br />
                        {countryName(localDraft.shipping.country)}
                      </>
                    )}
                  </div>
                </div>
              </div>
              {cartItems.map((it) => (
                <div key={it.sku} className="summary-row">
                  <span>{it.name} &times; {it.quantity}</span>
                  <span>{it.price || ''}</span>
                </div>
              ))}
            </div>

            <div className="breakdown-card">
              {localDraft.discount.type !== 'none' && (
                <div className="breakdown-row">
                  <span className="label">Discount to mention</span>
                  <span className="value">
                    {localDraft.discount.type === 'percent' ? `${localDraft.discount.value}%` : money(localDraft.discount.value)} — share this with the customer
                  </span>
                </div>
              )}
              {localDraft.shipMethod && (
                <div className="breakdown-row">
                  <span className="label">Shipping method</span>
                  <span className="value">{shipMethods.find(m => m.id === localDraft.shipMethod)?.name}</span>
                </div>
              )}
              <div className="breakdown-divider" />
              <div className="breakdown-total">
                <span>Total</span>
                <span>{workflow?.cart?.total ?? 'Confirming…'}</span>
              </div>
            </div>

            <div className="btn-row" style={{ marginTop: '9px', marginBottom: '9px' }}>
              <Button variant="secondary" onClick={() => setStep('shipping')}>Back</Button>
              <Button variant="secondary" onClick={requestPaymentReminder}>Send payment reminder</Button>
            </div>
            <Button variant="primary" disabled={isPlacingOrder || cartItems.length === 0} onClick={placeOrder}>
              {isPlacingOrder ? 'Placing your order…' : 'Place order'}
            </Button>
          </>
        )}

        {step === 'done' && (
          <SuccessBox
            title={workflow?.placedOrder?.orderNumber || workflow?.placedOrder?.orderId}
            sub={`Placed for ${workflow?.customer?.name} — ${workflow?.placedOrder?.total} total.`}
          />
        )}
      </div>

      {/* Footer / Buttons */}
      {step !== 'customer' && step !== 'shipping' && step !== 'review' && (
        <div className="options-foot">
          {step === 'items' && (
            <Button variant="primary" disabled={cartItems.length === 0} onClick={continueToDiscount}>
              Continue to discounts
            </Button>
          )}

          {step === 'discount' && (
            <Button variant="primary" onClick={continueToAddress}>
              Continue to addresses
            </Button>
          )}

          {step === 'address' && (
            <Button variant="primary" onClick={continueToShipping}>
              Continue to shipping method
            </Button>
          )}

          {step === 'done' && (
            <Button variant="primary" onClick={startNew}>
              Start another order
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
