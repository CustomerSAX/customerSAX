"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCartStore } from '../store/cart-store';
import { useConversationStore } from '../store/conversation-store';
import type { ProductCardArgs } from '../types';

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ color = '#fff' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin-pd 0.75s linear infinite', display: 'inline-block', verticalAlign: 'middle' }}>
      <style>{`@keyframes spin-pd{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── ProductDetailDrawer ──────────────────────────────────────────────────────

export function ProductDetailDrawer({
  isOpen,
  onClose,
  product,
  onAddToCart,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: ProductCardArgs;
  onAddToCart?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Cart state for this specific SKU.
  const cartItems = useCartStore((s) => s.items);
  const cartId = useCartStore((s) => s.cartId);
  const customer = useConversationStore((s) => s.customer);
  const [addBusy, setAddBusy] = useState(false);
  const [addFeedback, setAddFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find existing line item for this SKU in the cart.
  const cartItem = cartItems.find((i) => i.sku === product.sku);
  const inCart = !!cartItem;

  // Slide-in animation.
  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [isOpen]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      onClose();
      try { previouslyFocused.current?.focus?.(); } catch { /* best-effort */ }
    }, 240);
  };

  // Escape key.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddToCart = async () => {
    if (addBusy) return;
    setAddBusy(true);
    setAddFeedback(null);

    try {
      const result = await useCartStore.getState().addItem({
        sku: product.sku,
        name: product.name,
        customerId: customer?.id ?? null,
        priceLabel: product.price,
      });

      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (result.ok) {
        setAddFeedback({ type: 'success', msg: 'Added to cart!' });
        feedbackTimer.current = setTimeout(() => setAddFeedback(null), 2500);
        // Also call the parent callback for the AI hidden-action path.
        onAddToCart?.();
      } else {
        setAddFeedback({ type: 'error', msg: result.error ?? 'Failed to add — please try again.' });
        feedbackTimer.current = setTimeout(() => setAddFeedback(null), 4000);
      }
    } finally {
      setAddBusy(false);
    }
  };

  const handleChangeQuantity = async (delta: number) => {
    if (!cartItem) return;
    await useCartStore.getState().changeQuantity(cartItem.lineItemId, delta);
  };

  const handleViewCart = () => {
    handleClose();
    useCartStore.getState().openCart();
  };

  if (!isOpen && !closing) return null;
  if (typeof document === 'undefined') return null;

  const stockIsOut = product.stock.toLowerCase().includes('out');
  const stockIsLow = product.stock.toLowerCase().includes('low');
  const stockColor = stockIsOut ? '#c0392b' : stockIsLow ? '#d97706' : '#16a34a';
  const stockBg = stockIsOut ? '#fef2f2' : stockIsLow ? '#fffbeb' : '#f0fdf4';

  const drawerUi = (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(10,10,30,0.35)', zIndex: 1000,
          opacity: visible ? 1 : 0, transition: 'opacity 0.24s ease', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '95vw',
        backgroundColor: '#fff', zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 40px rgba(0,0,0,0.14)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.24s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
      }}>
        {/* Blue header */}
        <div style={{ backgroundColor: '#2563EB', padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>⚡ Product Details</span>
            </div>
            <button
              onClick={handleClose}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
              title="Close (Esc)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {product.category && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {product.category}
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 4, lineHeight: 1.3 }}>{product.name}</div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Image */}
          <div style={{ height: 240, backgroundColor: '#f8f9fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderBottom: '1px solid #eef0f5' }}>
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt={product.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', padding: 20 }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#c8ccd6' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span style={{ fontSize: 12 }}>No image available</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ padding: 20 }}>
            {/* Price + Stock */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#047857' }}>{product.price}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                backgroundColor: stockBg, color: stockColor,
                border: `1px solid ${stockColor}30`,
              }}>
                {stockIsOut ? '✗ Out of Stock' : stockIsLow ? '⚠ Low Stock' : '✓ In Stock'}
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #eef0f5' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{product.description}</p>
              </div>
            )}

            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <MetaRow label="SKU" value={product.sku} mono />
              {product.category && <MetaRow label="Category" value={product.category} />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #eef0f5', flexShrink: 0 }}>
          {addFeedback && (
            <div style={{
              marginBottom: 10, fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 6,
              backgroundColor: addFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: addFeedback.type === 'success' ? '#166534' : '#991b1b',
            }}>
              {addFeedback.type === 'success' ? '✓' : '⚠'} {addFeedback.msg}
            </div>
          )}

          {inCart && cartItem ? (
            // Item already in cart — show quantity controls + View Cart.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>In cart: {cartItem.quantity}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => void handleChangeQuantity(-1)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #93c5fd', backgroundColor: '#fff', color: '#1d4ed8', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                  >−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{cartItem.quantity}</span>
                  <button
                    onClick={() => void handleChangeQuantity(1)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #93c5fd', backgroundColor: '#fff', color: '#1d4ed8', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                  >+</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleViewCart}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                    backgroundColor: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  View Cart
                </button>
                <button
                  onClick={handleClose}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #dde1ea', backgroundColor: '#fff', color: '#4b5563', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            // Item not in cart — show Add to Cart.
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void handleAddToCart()}
                disabled={addBusy || stockIsOut}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  backgroundColor: stockIsOut ? '#d1d5db' : addBusy ? '#f59e0b' : '#f97316',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: stockIsOut ? 'not-allowed' : addBusy ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {addBusy ? (
                  <><Spinner /> Adding…</>
                ) : stockIsOut ? (
                  'Out of Stock'
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    Add to Cart
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #dde1ea', backgroundColor: '#fff', color: '#4b5563', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          )}

          {/* View Cart shortcut if cart has items */}
          {!inCart && cartId && (
            <button
              onClick={handleViewCart}
              style={{
                width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 8,
                border: '1px solid #bfdbfe', backgroundColor: '#eff6ff',
                color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              View Cart
            </button>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawerUi, document.body);
}

// ─── Meta row ─────────────────────────────────────────────────────────────────

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#374151', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
