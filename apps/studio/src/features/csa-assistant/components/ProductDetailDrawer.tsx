"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCartStore } from '../store/cart-store';
import { useConversationStore } from '../store/conversation-store';
import type { ProductCardArgs } from '../types';
import type { ProductDetail } from '../../products/types/product-types';
import { mapRawToDetail } from '../../products/utils/product-utils';

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ color = 'var(--color-text-inverse)' }: { color?: string }) {
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
  const customer = useConversationStore((s) => s.customer);
  const [busy, setBusy] = useState<'add' | 'increase' | 'decrease' | 'remove' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [richProduct, setRichProduct] = useState<ProductDetail | null>(null);

  // Merge the AI's product data with the fully fetched richProduct data
  const displayProduct: ProductCardArgs = {
    ...product,
    description: richProduct && richProduct.productDescription !== '--' 
      ? richProduct.productDescription 
      : product.description,
    category: richProduct && richProduct.categories.length > 0 
      ? richProduct.categories[0].name 
      : product.category,
    variants: richProduct && richProduct.variants.length > 0 
      ? richProduct.variants.map(v => ({
          sku: v.sku,
          price: v.unitPrice,
          stock: String(v.quantity),
          images: v.images
        }))
      : product.variants
  };

  const selectedVariant = displayProduct.variants?.[selectedVariantIdx];
  const activeSku = selectedVariant?.sku ?? displayProduct.sku;
  const activePrice = selectedVariant?.price ?? displayProduct.price;
  const activeStock = selectedVariant?.stock ?? displayProduct.stock;

  const allImages = displayProduct.variants
    ? displayProduct.variants.flatMap(v => v.images ?? [])
    : (displayProduct.images ?? (displayProduct.image ? [displayProduct.image] : []));
  const uniqueImages = allImages.filter((img, i, arr) => arr.indexOf(img) === i && !!img);
  const heroImage = selectedImage ?? uniqueImages[0] ?? displayProduct.image ?? null;

  // Find existing line item for this active SKU in the cart.
  const cartItem = cartItems.find((i) => i.sku === activeSku);
  const isInCart = !!cartItem;
  const cartQuantity = cartItem?.quantity ?? 0;

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

  // Fetch full product details
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    
    async function fetchRichProduct() {
      try {
        let productId = product.slug;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId || '');
        
        if (!isUUID) {
          const queryText = product.sku || product.name || product.slug;
          if (!queryText) return;

          const res = await fetch("/api/product-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: queryText, limit: 5 }),
          });
          if (!res.ok) return;
          const json = await res.json();
          const results = json.results || [];

          // Match by SKU, key, or name, falling back to first match
          const match = results.find((r: any) => {
            const current = r.masterData?.current;
            const skus = [
              current?.masterVariant?.sku,
              ...(current?.allVariants?.map((v: any) => v.sku) || [])
            ].filter(Boolean);
            return (
              (product.sku && skus.includes(product.sku)) ||
              r.key === product.sku ||
              r.id === product.sku
            );
          }) || results[0];

          if (match?.masterData && !cancelled) {
            setRichProduct(mapRawToDetail(match));
            return;
          }

          productId = match?.id;
        }

        if (!productId || cancelled) return;

        const res = await fetch(`/api/products/${encodeURIComponent(productId)}`);
        if (!res.ok) return;
        const raw = await res.json();
        
        if (!cancelled && raw && raw.masterData) {
          setRichProduct(mapRawToDetail(raw));
        }
      } catch (e) {
        console.error("Failed to fetch rich product details:", e);
      }
    }

    fetchRichProduct();
    return () => { cancelled = true; };
  }, [isOpen, product.sku, product.slug, product.name]);

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

  const runCartAction = async (
    action: 'add' | 'increase' | 'decrease' | 'remove',
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string
  ) => {
    setBusy(action);
    setFeedback(null);
    try {
      const res = await fn();
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (res.ok) {
        setFeedback({ type: 'success', message: successMsg });
        feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
        if (action === 'add') onAddToCart?.();
      } else {
        setFeedback({ type: 'error', message: res.error ?? 'Cart action failed' });
        feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleAddToCart = () => {
    void runCartAction('add', () =>
      useCartStore.getState().addItem({
        sku: activeSku,
        name: displayProduct.name,
        customerId: customer?.id ?? null,
        priceLabel: activePrice,
      }), 'Added to cart ✓');
  };

  const handleIncrease = () => {
    if (!cartItem) return;
    void runCartAction('increase', () =>
      useCartStore.getState().changeQuantity(cartItem.lineItemId, 1), 'Quantity updated');
  };

  const handleDecrease = () => {
    if (!cartItem) return;
    void runCartAction('decrease', () =>
      useCartStore.getState().changeQuantity(cartItem.lineItemId, -1), 'Quantity updated');
  };

  const handleRemove = () => {
    if (!cartItem) return;
    void runCartAction('remove', () =>
      useCartStore.getState().removeItem(cartItem.lineItemId), 'Removed from cart');
  };

  const handleViewCart = () => {
    handleClose();
    useCartStore.getState().openCart();
  };

  if (!isOpen && !closing) return null;
  if (typeof document === 'undefined') return null;

  const stockIsOut = activeStock.toLowerCase().includes('out') || activeStock === '0';
  const stockIsLow = activeStock.toLowerCase().includes('low');
  const inStock = !stockIsOut;
  // NOTE: stockColor stays literal hex (not a var()) because it's concatenated
  // with a hex alpha suffix below (`${stockColor}40`) for the badge border —
  // CSS custom properties can't have a hex alpha suffix appended to them.
  const stockColor = stockIsOut ? '#c0392b' : stockIsLow ? '#d97706' : '#16a34a';
  const stockBg = stockIsOut ? 'var(--color-error-bg)' : stockIsLow ? 'var(--color-warning-bg)' : 'var(--color-success-bg)';
  const stockLabel = stockIsOut ? 'Out of Stock' : stockIsLow ? 'Low Stock' : 'In Stock';

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
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 600, maxWidth: '95vw',
        backgroundColor: 'var(--color-surface-1)', zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 40px rgba(0,0,0,0.14)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.24s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
      }}>
        {/* Blue header */}
        <div style={{ backgroundColor: 'var(--color-primary)', padding: '14px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path d="M10 1 C10.8 5.5 12.5 7.5 18 10 C12.5 12.5 10.8 14.5 10 19 C9.2 14.5 7.5 12.5 2 10 C7.5 7.5 9.2 5.5 10 1 Z" fill="white" />
              <circle cx="17" cy="3" r="1.2" fill="white" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-inverse)', letterSpacing: '0.02em' }}>
              Product Details
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-inverse)' }}
            title="Close (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Images */}
          <div style={{ padding: '20px 24px 0', display: 'flex', gap: '12px' }}>
            {/* Thumbnail column */}
            {uniqueImages.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                {uniqueImages.slice(0, 6).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    style={{
                      width: 56, height: 56, borderRadius: 8, overflow: 'hidden', padding: 0, cursor: 'pointer',
                      border: (selectedImage ?? uniqueImages[0]) === img ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                  </button>
                ))}
              </div>
            )}
            
            {/* Main hero */}
            <div style={{ flex: 1, height: 280, backgroundColor: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              {heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt={displayProduct.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', padding: 16 }} />
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-subtle)" strokeWidth="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: '20px 24px' }}>
            {displayProduct.category && (
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                {displayProduct.category}
              </div>
            )}
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1.35 }}>
              {displayProduct.name}
            </h2>

            {/* Price + Stock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>{activePrice}</span>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                backgroundColor: stockBg, color: stockColor,
                border: `1px solid ${stockColor}40`,
              }}>
                {stockLabel}
              </span>
            </div>

            {/* Category tag */}
            {displayProduct.category && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}>
                  {displayProduct.category}
                </span>
              </div>
            )}

            {/* Description */}
            {displayProduct.description && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Description</div>
                <p style={{ fontSize: 13.5, color: 'var(--color-ink)', lineHeight: 1.7, margin: 0 }}>{displayProduct.description}</p>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0 16px' }} />

            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 20 }}>
              <MetaRow label="SKU" value={activeSku} mono />
              <MetaRow label="Product key" value={richProduct?.key ?? activeSku} mono />
              {displayProduct.category && <MetaRow label="Product type" value={displayProduct.category} />}
              {displayProduct.variants && displayProduct.variants.length > 1 && (
                <MetaRow label="Variants" value={`${displayProduct.variants.length} variants`} />
              )}
            </div>

            {/* Variants List */}
            {displayProduct.variants && displayProduct.variants.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {displayProduct.variants.length > 1 ? `All Variants (${displayProduct.variants.length}) — select one` : 'Variant'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {displayProduct.variants.map((v, idx) => {
                    const vStockOut = v.stock.toLowerCase().includes('out') || v.stock === '0';
                    const isSelected = idx === selectedVariantIdx;
                    const vImage = v.images?.[0] ?? heroImage;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedVariantIdx(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8,
                          backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
                          border: `${isSelected ? '2px' : '1px'} solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          opacity: vStockOut ? 0.55 : 1,
                        }}
                      >
                        {vImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vImage} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, flexShrink: 0, backgroundColor: 'var(--color-surface-1)', padding: 2, border: '1px solid var(--color-border)' }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', fontFamily: 'monospace' }}>{v.sku}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{v.sku}</div>
                        </div>
                        {v.price && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', flexShrink: 0 }}>{v.price}</div>
                        )}
                        <div style={{ fontSize: 10, fontWeight: 600, color: vStockOut ? 'var(--color-error)' : 'var(--color-success)', flexShrink: 0 }}>
                          {vStockOut ? 'Out of Stock' : 'In Stock'}
                        </div>
                        {isSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar matching standalone 100% */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {feedback && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              fontSize: 12, fontWeight: 600, padding: '7px 10px', borderRadius: 8,
              backgroundColor: feedback.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
              color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            }}>
              <span>{feedback.type === 'success' ? '✓' : '⚠'} {feedback.message}</span>
              {feedback.type === 'success' && (
                <button
                  onClick={handleViewCart}
                  style={{ border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
                >
                  View Cart
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {inStock && !isInCart && (
              <button
                onClick={handleAddToCart}
                disabled={busy === 'add'}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)', fontSize: 13, fontWeight: 700,
                  cursor: busy === 'add' ? 'wait' : 'pointer', opacity: busy === 'add' ? 0.75 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {busy === 'add' ? (
                  <><Spinner /> Adding…</>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    Add to Cart
                  </>
                )}
              </button>
            )}

            {!inStock && (
              <button
                disabled
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  backgroundColor: 'var(--color-border-strong)', color: 'var(--color-text-inverse)', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
                }}
              >
                Out of Stock
              </button>
            )}

            {inStock && isInCart && cartItem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: '1px solid var(--color-border)', borderRadius: 8, padding: '4px 10px',
                }}>
                  <button
                    onClick={handleDecrease}
                    disabled={!!busy}
                    style={{ border: 'none', background: 'transparent', fontSize: '16px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', color: 'var(--color-primary)', padding: '0 4px', opacity: busy === 'decrease' ? 0.5 : 1 }}
                  >
                    {busy === 'decrease' ? <Spinner color="var(--color-primary)" /> : '−'}
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{cartQuantity}</span>
                  <button
                    onClick={handleIncrease}
                    disabled={!!busy}
                    style={{ border: 'none', background: 'transparent', fontSize: '16px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', color: 'var(--color-primary)', padding: '0 4px', opacity: busy === 'increase' ? 0.5 : 1 }}
                  >
                    {busy === 'increase' ? <Spinner color="var(--color-primary)" /> : '+'}
                  </button>
                </div>
                <button
                  onClick={handleRemove}
                  disabled={!!busy}
                  style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-error-border)',
                    backgroundColor: 'transparent', color: 'var(--color-error)', fontSize: 13, fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    opacity: busy === 'remove' ? 0.6 : 1,
                  }}
                >
                  {busy === 'remove' ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )}

            {isInCart && (
              <button
                onClick={handleViewCart}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: '1px solid var(--color-primary-border)',
                  backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                View Cart
              </button>
            )}

            <button
              onClick={handleClose}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
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
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-ink)', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  );
}
