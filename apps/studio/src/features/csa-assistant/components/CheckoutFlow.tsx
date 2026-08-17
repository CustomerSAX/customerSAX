"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  useCheckoutStore,
  addressSummary,
  type CheckoutCustomer,
  type CustomerAddress,
} from '../store/checkout-store';
import { useConversationStore } from '../store/conversation-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BLUE = 'var(--color-primary)';
const BORDER = 'var(--color-border)';

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', IN: 'India', DE: 'Germany', FR: 'France',
  CA: 'Canada', AU: 'Australia', AE: 'United Arab Emirates', SG: 'Singapore', JP: 'Japan',
  IT: 'Italy', ES: 'Spain', NL: 'Netherlands', SE: 'Sweden', CH: 'Switzerland',
};
function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] ? `${COUNTRY_NAMES[code]} (${code})` : code;
}

function Spinner({ color = 'var(--color-text-inverse)' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin-co 0.75s linear infinite', display: 'inline-block', verticalAlign: 'middle' }}>
      <style>{`@keyframes spin-co{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: active || done ? 1 : 0.45 }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: done ? 'var(--color-success)' : active ? BLUE : 'var(--color-border-strong)', color: 'var(--color-text-inverse)',
      }}>{done ? '✓' : n}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? 'var(--color-ink)' : 'var(--color-text-muted)' }}>{label}</span>
    </div>
  );
}

const primaryBtn = (disabled?: boolean): React.CSSProperties => ({
  padding: '9px 18px', borderRadius: 8, border: 'none',
  backgroundColor: disabled ? 'var(--color-border-strong)' : BLUE,
  color: 'var(--color-text-inverse)', fontSize: 13, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
});
const ghostBtn: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, border: `1px solid ${BORDER}`,
  backgroundColor: 'transparent', color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6,
  fontSize: 13, color: 'var(--color-ink)', boxSizing: 'border-box', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.04em', marginBottom: 3, display: 'block',
};

// ─── Address form state ───────────────────────────────────────────────────────

interface ManualAddress {
  firstName: string; lastName: string;
  streetNumber: string; streetName: string;
  city: string; state: string;
  postalCode: string; country: string;
}
const emptyManual: ManualAddress = {
  firstName: '', lastName: '', streetNumber: '', streetName: '',
  city: '', state: '', postalCode: '', country: '',
};
function manualToInput(m: ManualAddress): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = (k: string, v: string) => { const t = v.trim(); if (t) out[k] = t; };
  s('firstName', m.firstName); s('lastName', m.lastName);
  s('streetNumber', m.streetNumber); s('streetName', m.streetName);
  s('city', m.city); s('state', m.state);
  s('postalCode', m.postalCode); s('country', m.country);
  return out;
}
function manualSummary(m: ManualAddress): string {
  return [[m.streetNumber, m.streetName].filter(Boolean).join(' '), m.city, m.state, m.postalCode, m.country]
    .filter(Boolean).join(', ');
}

// ─── Review row ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-ink)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ─── CheckoutFlow ─────────────────────────────────────────────────────────────

export function CheckoutFlow({ onViewOrder }: { onViewOrder?: (orderNumber: string) => void }) {
  const co = useCheckoutStore();
  const convCustomer = useConversationStore((s) => s.customer);

  const [customerMode, setCustomerMode] = useState<'identified' | 'manual'>('identified');
  const [manualInput, setManualInput] = useState('');
  const [showManualAddress, setShowManualAddress] = useState(false);
  const [manualAddr, setManualAddr] = useState<ManualAddress>(emptyManual);
  const [selectedShip, setSelectedShip] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);

  // Load configured countries when the address step is reached.
  useEffect(() => {
    if (co.step !== 'address') return;
    if (countries.length > 0) return;
    fetch('/api/shipping-methods')
      .then(() => {
        // We reuse a simple hardcoded country list for now; CT doesn't expose a
        // "configured countries" endpoint. The real countries come from the first
        // address the rep sets — we just want to show a dropdown.
        const list = Object.keys(COUNTRY_NAMES);
        setCountries(list);
        setManualAddr((prev) => prev.country ? prev : { ...prev, country: list[0] ?? '' });
      })
      .catch(() => {
        // Fall back to US — the input is still editable as plain text.
        setManualAddr((prev) => prev.country ? prev : { ...prev, country: 'US' });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [co.step]);

  const identified: CheckoutCustomer | null = useMemo(() => {
    if (co.customer?.id || co.customer?.email) return co.customer;
    if (convCustomer && (convCustomer.id || convCustomer.email)) {
      return { id: convCustomer.id, email: convCustomer.email, name: convCustomer.name };
    }
    return null;
  }, [co.customer, convCustomer]);

  // Reset local state each time the flow (re)opens.
  useEffect(() => {
    if (co.isOpen) {
      setCustomerMode(identified?.id || identified?.email ? 'identified' : 'manual');
      setManualInput('');
      setShowManualAddress(false);
      setManualAddr(emptyManual);
      setSelectedShip(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [co.isOpen]);

  if (!co.isOpen) return null;

  const stepOrder = ['customer', 'address', 'shipping', 'review'] as const;
  const currentIdx = stepOrder.indexOf(co.step as typeof stepOrder[number]);

  return (
    <div style={{
      margin: '10px 16px 16px', border: `1px solid ${BORDER}`, borderRadius: 12,
      overflow: 'hidden', backgroundColor: 'var(--color-surface-1)', boxShadow: 'var(--shadow-md)', maxWidth: 560,
    }}>
      {/* Header */}
      <div style={{ backgroundColor: BLUE, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-inverse)' }}>
          {co.step === 'done' ? '✓ Order placed' : '⚡ Checkout'}
        </span>
        {co.step !== 'done' && (
          <button
            onClick={() => co.reset()}
            title="Cancel checkout"
            style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: 'var(--color-text-inverse)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {/* Step indicator */}
      {co.step !== 'done' && (
        <div style={{ display: 'flex', gap: 14, padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
          <StepBadge n={1} label="Customer" active={co.step === 'customer'} done={currentIdx > 0} />
          <StepBadge n={2} label="Address" active={co.step === 'address'} done={currentIdx > 1} />
          <StepBadge n={3} label="Shipping" active={co.step === 'shipping'} done={currentIdx > 2} />
          <StepBadge n={4} label="Review" active={co.step === 'review'} done={false} />
        </div>
      )}

      <div style={{ padding: 16 }}>
        {co.error && (
          <div style={{
            marginBottom: 12, fontSize: 12, fontWeight: 600, padding: '8px 10px', borderRadius: 6,
            backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)',
          }}>⚠ {co.error}</div>
        )}

        {/* ── STEP 1: Customer ── */}
        {co.step === 'customer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>Who is this order for?</div>

            {identified && (
              <label style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8,
                border: `${customerMode === 'identified' ? 2 : 1}px solid ${customerMode === 'identified' ? BLUE : BORDER}`,
                cursor: 'pointer', backgroundColor: customerMode === 'identified' ? 'var(--color-primary-light)' : 'var(--color-surface-1)',
              }}>
                <input type="radio" checked={customerMode === 'identified'} onChange={() => setCustomerMode('identified')} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{identified.name ?? 'Identified customer'}</div>
                  {identified.email && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{identified.email}</div>}
                  {identified.id && <div style={{ fontSize: 10, color: 'var(--color-text-subtle)', fontFamily: 'monospace', marginTop: 2 }}>{identified.id.slice(0, 8)}…</div>}
                </div>
              </label>
            )}

            <label style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8,
              border: `${customerMode === 'manual' ? 2 : 1}px solid ${customerMode === 'manual' ? BLUE : BORDER}`,
              cursor: 'pointer', backgroundColor: customerMode === 'manual' ? 'var(--color-primary-light)' : 'var(--color-surface-1)',
            }}>
              <input type="radio" checked={customerMode === 'manual'} onChange={() => setCustomerMode('manual')} style={{ marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', marginBottom: customerMode === 'manual' ? 8 : 0 }}>
                  {identified ? 'Someone else' : 'Find customer'}
                </div>
                {customerMode === 'manual' && (
                  <div>
                    <label style={labelStyle}>Name or email</label>
                    <input
                      style={inputStyle}
                      value={manualInput}
                      placeholder="e.g. John Doe or john@example.com"
                      onChange={(e) => setManualInput(e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      I&apos;ll check if this customer exists and use their saved details.
                    </div>
                  </div>
                )}
              </div>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button style={ghostBtn} onClick={() => co.reset()} disabled={co.busy}>Cancel</button>
              <button
                style={primaryBtn(co.busy || (customerMode === 'manual' && !manualInput.trim()) || (customerMode === 'identified' && !identified))}
                disabled={co.busy || (customerMode === 'manual' && !manualInput.trim()) || (customerMode === 'identified' && !identified)}
                onClick={() => {
                  const term = manualInput.trim();
                  const chosen: CheckoutCustomer = customerMode === 'identified' && identified
                    ? identified
                    : term.includes('@') ? { email: term } : { name: term };
                  void co.confirmCustomer(chosen);
                }}
              >
                {co.busy ? <><Spinner /> Checking…</> : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Address ── */}
        {co.step === 'address' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>Shipping address</div>

            {!showManualAddress && co.addresses.length > 0 && (
              <>
                {co.addresses.map((addr: CustomerAddress, i) => (
                  <div key={addr.id ?? i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ fontSize: 12.5, color: 'var(--color-ink)' }}>
                      {(addr.firstName || addr.lastName) && (
                        <div style={{ fontWeight: 600 }}>{[addr.firstName, addr.lastName].filter(Boolean).join(' ')}</div>
                      )}
                      <div style={{ color: 'var(--color-text-muted)' }}>{addressSummary(addr)}</div>
                    </div>
                    <button style={primaryBtn(co.busy)} disabled={co.busy} onClick={() => void co.useSavedAddress(addr)}>
                      {co.busy ? <Spinner /> : 'Use'}
                    </button>
                  </div>
                ))}
                <button style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={() => setShowManualAddress(true)} disabled={co.busy}>
                  Enter a different address
                </button>
              </>
            )}

            {(showManualAddress || co.addresses.length === 0) && (
              <>
                {co.addresses.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No saved addresses — please enter one.</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={labelStyle}>First name</label><input style={inputStyle} value={manualAddr.firstName} onChange={(e) => setManualAddr({ ...manualAddr, firstName: e.target.value })} /></div>
                  <div><label style={labelStyle}>Last name</label><input style={inputStyle} value={manualAddr.lastName} onChange={(e) => setManualAddr({ ...manualAddr, lastName: e.target.value })} /></div>
                  <div><label style={labelStyle}>Street no.</label><input style={inputStyle} value={manualAddr.streetNumber} onChange={(e) => setManualAddr({ ...manualAddr, streetNumber: e.target.value })} /></div>
                  <div><label style={labelStyle}>Street name</label><input style={inputStyle} value={manualAddr.streetName} onChange={(e) => setManualAddr({ ...manualAddr, streetName: e.target.value })} /></div>
                  <div><label style={labelStyle}>City</label><input style={inputStyle} value={manualAddr.city} onChange={(e) => setManualAddr({ ...manualAddr, city: e.target.value })} /></div>
                  <div><label style={labelStyle}>State / region</label><input style={inputStyle} value={manualAddr.state} onChange={(e) => setManualAddr({ ...manualAddr, state: e.target.value })} /></div>
                  <div><label style={labelStyle}>Postal code</label><input style={inputStyle} value={manualAddr.postalCode} onChange={(e) => setManualAddr({ ...manualAddr, postalCode: e.target.value })} /></div>
                  <div>
                    <label style={labelStyle}>Country (required)</label>
                    {countries.length > 0 ? (
                      <select style={inputStyle} value={manualAddr.country} onChange={(e) => setManualAddr({ ...manualAddr, country: e.target.value })}>
                        <option value="">Select…</option>
                        {countries.map((c) => <option key={c} value={c}>{countryLabel(c)}</option>)}
                      </select>
                    ) : (
                      <input style={inputStyle} value={manualAddr.country} placeholder="US" maxLength={2}
                        onChange={(e) => setManualAddr({ ...manualAddr, country: e.target.value.toUpperCase() })} />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <button style={ghostBtn} onClick={() => co.addresses.length > 0 ? setShowManualAddress(false) : co.goTo('customer')} disabled={co.busy}>Back</button>
                  <button
                    style={primaryBtn(co.busy || !manualAddr.country.trim())}
                    disabled={co.busy || !manualAddr.country.trim()}
                    onClick={() => void co.useManualAddress(manualToInput(manualAddr), manualSummary(manualAddr))}
                  >
                    {co.busy ? <><Spinner /> Saving…</> : 'Use this address'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Shipping ── */}
        {co.step === 'shipping' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>Shipping method</div>

            {co.shippingMethods.length === 0 ? (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>No shipping methods are configured. You can continue without one.</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button style={ghostBtn} onClick={() => co.goTo('address')} disabled={co.busy}>Back</button>
                  <button style={primaryBtn(co.busy)} disabled={co.busy} onClick={() => void co.skipShipping()}>
                    {co.busy ? <><Spinner /> …</> : 'Continue →'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {co.shippingMethods.map((m) => (
                  <label key={m.id} style={{
                    display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 8,
                    border: `${selectedShip === m.id ? 2 : 1}px solid ${selectedShip === m.id ? BLUE : BORDER}`,
                    cursor: 'pointer', backgroundColor: selectedShip === m.id ? 'var(--color-primary-light)' : 'var(--color-surface-1)',
                  }}>
                    <input type="radio" checked={selectedShip === m.id} onChange={() => setSelectedShip(m.id)} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{m.name}</span>
                  </label>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <button style={ghostBtn} onClick={() => co.goTo('address')} disabled={co.busy}>Back</button>
                  <button style={primaryBtn(co.busy || !selectedShip)} disabled={co.busy || !selectedShip}
                    onClick={() => selectedShip && void co.chooseShippingMethod(selectedShip)}>
                    {co.busy ? <><Spinner /> Saving…</> : 'Continue →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 4: Review ── */}
        {co.step === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>Review &amp; place order</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <Row label="Customer" value={co.customer?.name ?? co.customer?.email ?? '—'} />
              <Row label="Ship to" value={co.chosenAddressSummary ?? '—'} />
              <Row label="Shipping" value={co.chosenShippingMethodName ?? 'Not specified'} />
              <Row label="Items" value={String(co.itemCount)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)' }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-ink)' }}>{co.totalLabel ?? '—'}</span>
              </div>
            </div>

            <label style={{
              display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 8,
              backgroundColor: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', cursor: 'pointer',
            }}>
              <input type="checkbox" checked={co.markPaid} onChange={(e) => co.setMarkPaid(e.target.checked)} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-success)' }}>Mark as paid — payment collected offline</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button style={ghostBtn} onClick={() => co.goTo('shipping')} disabled={co.busy}>Back</button>
              <button
                style={{ ...primaryBtn(co.busy), backgroundColor: co.busy ? 'var(--color-border-strong)' : 'var(--color-success)' }}
                disabled={co.busy}
                onClick={() => void co.placeOrder()}
              >
                {co.busy ? <><Spinner /> Placing order…</> : '✓ Place Order'}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {co.step === 'done' && co.order && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '6px 0' }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%', backgroundColor: 'var(--color-success-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-ink)' }}>Order placed successfully</div>
            {co.order.orderNumber && (
              <div style={{ fontSize: 13, color: 'var(--color-ink)' }}>
                Order <strong>{co.order.orderNumber}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              {co.order.total && (
                <span>Total: <strong style={{ color: 'var(--color-ink)' }}>{co.order.total}</strong></span>
              )}
              <span>
                Payment:{' '}
                <strong style={{ color: co.order.paid ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {co.order.paid ? 'Paid' : 'Pending'}
                </strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                style={ghostBtn}
                onClick={() => {
                  const ref = co.order?.orderNumber ?? co.order?.id;
                  co.reset();
                  if (ref && onViewOrder) onViewOrder(ref);
                }}
              >
                View order
              </button>
              <button style={primaryBtn(false)} onClick={() => co.reset()}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
