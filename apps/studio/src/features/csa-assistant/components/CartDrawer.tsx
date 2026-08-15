"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCartStore, type CartActionResult } from '../store/cart-store';
import { useCheckoutStore } from '../store/checkout-store';
import { useConversationStore } from '../store/conversation-store';

// ─── Mini spinner ─────────────────────────────────────────────────────────────

function Spinner({ color = 'var(--color-primary)', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.75s linear infinite', display: 'inline-block' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Line item row ────────────────────────────────────────────────────────────

type RowBusy = 'increase' | 'decrease' | 'remove';

function CartLineRow({
  name,
  sku,
  quantity,
  unitPriceLabel,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  name?: string;
  sku?: string;
  quantity: number;
  unitPriceLabel?: string;
  onIncrease: () => Promise<CartActionResult>;
  onDecrease: () => Promise<CartActionResult>;
  onRemove: () => Promise<CartActionResult>;
}) {
  const [busy, setBusy] = useState<RowBusy | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function run(kind: RowBusy, action: () => Promise<CartActionResult>) {
    if (busy) return;
    setBusy(kind);
    const res = await action();
    if (timer.current) clearTimeout(timer.current);
    if (!res.ok) {
      setFeedback({ type: 'error', msg: res.error ?? 'Failed — please try again.' });
      timer.current = setTimeout(() => setFeedback(null), 3500);
    }
    setBusy(null);
  }

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.4 }}>{name ?? 'Item'}</div>
          {sku && <div style={{ fontSize: 10, color: 'var(--color-text-subtle)', fontFamily: 'monospace', marginTop: 2 }}>SKU: {sku}</div>}
        </div>
        {unitPriceLabel && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>{unitPriceLabel}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border)', borderRadius: 8, padding: '4px 10px' }}>
          <button
            onClick={() => void run('decrease', onDecrease)}
            disabled={!!busy}
            style={{ border: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', cursor: busy ? 'wait' : 'pointer', padding: '0 4px', opacity: busy === 'decrease' ? 0.5 : 1 }}
          >{busy === 'decrease' ? <Spinner /> : '−'}</button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{quantity}</span>
          <button
            onClick={() => void run('increase', onIncrease)}
            disabled={!!busy}
            style={{ border: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', cursor: busy ? 'wait' : 'pointer', padding: '0 4px', opacity: busy === 'increase' ? 0.5 : 1 }}
          >{busy === 'increase' ? <Spinner /> : '+'}</button>
        </div>
        <button
          onClick={() => void run('remove', onRemove)}
          disabled={!!busy}
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-error-border)', backgroundColor: 'transparent',
            color: 'var(--color-error)', fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, opacity: busy === 'remove' ? 0.6 : 1,
          }}
        >
          {busy === 'remove' ? <><Spinner color="var(--color-error)" /> Removing…</> : 'Remove'}
        </button>
      </div>
      {feedback && (
        <div style={{
          marginTop: 8, fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 6,
          backgroundColor: feedback.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
        }}>
          {feedback.type === 'success' ? '✓' : '⚠'} {feedback.msg}
        </div>
      )}
    </div>
  );
}

// ─── Main CartDrawer ──────────────────────────────────────────────────────────

export function CartDrawer() {
  const cart = useCartStore();
  const convCustomer = useConversationStore((s) => s.customer);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cart.isCartOpen) {
      setClosing(false);
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [cart.isCartOpen]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const handleClose = () => {
    setVisible(false);
    setClosing(true);
    useCartStore.getState().closeCart();
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      try { previouslyFocused.current?.focus?.(); } catch { /* best-effort */ }
    }, 240);
  };

  const startCheckout = () => {
    if (!cart.cartId) return;
    useCheckoutStore.getState().start(
      cart.cartId,
      convCustomer?.id || convCustomer?.email
        ? { id: convCustomer?.id, email: convCustomer?.email, name: convCustomer?.name }
        : null,
    );
    handleClose();
  };

  useEffect(() => {
    if (!cart.isCartOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.isCartOpen]);

  if (!cart.isCartOpen && !closing) return null;
  if (typeof document === 'undefined') return null;

  const itemCount = cart.items.reduce((n, i) => n + i.quantity, 0);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(10,10,30,0.4)', zIndex: 1100,
          opacity: visible ? 1 : 0, transition: 'opacity 0.24s ease', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '95vw',
        backgroundColor: 'var(--color-surface-1)', zIndex: 1101, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 40px rgba(0,0,0,0.14)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.24s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, backgroundColor: 'var(--color-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-inverse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-inverse)', letterSpacing: '0.02em' }}>
              Cart{itemCount > 0 ? ` (${itemCount})` : ''}
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)',
              background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--color-text-inverse)',
            }}
            title="Close (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px' }}>
          {cart.resolving && cart.items.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--color-text-subtle)', fontSize: 13, gap: 10 }}>
              <Spinner /> Loading cart…
            </div>
          )}
          {!cart.resolving && cart.error && cart.items.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--color-error)', fontSize: 13, gap: 8, textAlign: 'center', padding: '0 12px' }}>
              ⚠ Unable to load cart. Please try again.
            </div>
          )}
          {!cart.resolving && !cart.error && cart.items.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--color-text-subtle)', fontSize: 13, gap: 8, textAlign: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              The cart is empty.
              <span style={{ fontSize: 11 }}>Add a product to get started.</span>
            </div>
          )}
          {cart.items.map((item) => (
            <CartLineRow
              key={item.lineItemId}
              name={item.name}
              sku={item.sku}
              quantity={item.quantity}
              unitPriceLabel={item.unitPriceLabel}
              onIncrease={() => useCartStore.getState().changeQuantity(item.lineItemId, 1)}
              onDecrease={() => useCartStore.getState().changeQuantity(item.lineItemId, -1)}
              onRemove={() => useCartStore.getState().removeItem(item.lineItemId)}
            />
          ))}
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            {cart.hasDiscount && cart.subtotalLabel && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>Subtotal</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{cart.subtotalLabel}</span>
              </div>
            )}
            {cart.hasDiscount && cart.discountLabel && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-success)' }}>Discount</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>−{cart.discountLabel}</span>
              </div>
            )}
            {cart.totalLabel && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginBottom: 12,
                paddingTop: cart.hasDiscount ? 8 : undefined,
                borderTop: cart.hasDiscount ? '1px solid var(--color-border)' : undefined,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>{cart.totalLabel}</span>
              </div>
            )}
            <button
              onClick={startCheckout}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                backgroundColor: 'var(--color-success)', color: 'var(--color-text-inverse)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              Proceed to Checkout
            </button>
            <button
              onClick={handleClose}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid var(--color-border)',
                backgroundColor: 'transparent', color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Continue Shopping
            </button>
          </div>
        )}
        {!cart.resolving && cart.items.length === 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            <button
              onClick={handleClose}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
