"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";
import { ProductDetailDrawer } from "./ProductDetailDrawer";
import { useCartStore } from "../store/cart-store";
import { useConversationStore } from "../store/conversation-store";
import type {
  CartSummaryArgs,
  CaseBriefingArgs,
  DraftEmailArgs,
  OrderConfirmationArgs,
  OrderSummaryArgs,
  ProductCardArgs,
  RenderRefundActionArgs
} from "../types";

// ─── Sentiment badge ──────────────────────────────────────────────────────────

const SENTIMENT_VARIANT: Record<string, "neutral" | "success" | "warning" | "error" | "info"> = {
  positive: "success",
  resolved: "success",
  neutral: "neutral",
  concerned: "warning",
  frustrated: "error"
};

// ─── Order Summary Card ───────────────────────────────────────────────────────

export function OrderSummaryCard({ args }: { args: OrderSummaryArgs }) {
  const statusVariant =
    args.status === "Complete" ? "success"
    : args.status === "Cancelled" ? "error"
    : args.status === "Shipped" ? "info"
    : "neutral";

  return (
    <Card variant="default" className="my-2 max-w-md">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Order {args.orderNumber}</CardTitle>
          <Badge variant={statusVariant} size="sm">{args.status}</Badge>
        </div>
        <p className="text-xs text-m-text-muted mt-0.5">{args.customer.name}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Date</span>
          <span className="font-medium">{args.date}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Items</span>
          <span className="font-medium">{args.itemCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Total</span>
          <span className="font-semibold text-m-text">{args.total}</span>
        </div>
        {args.shipment && (
          <div className="pt-1.5 border-t border-m-border flex justify-between text-xs">
            <span className="text-m-text-muted">Shipment</span>
            <span className="font-medium">{args.shipment.status}</span>
          </div>
        )}
        {args.shipment?.trackingNumber && (
          <div className="flex justify-between text-xs">
            <span className="text-m-text-muted">Tracking</span>
            <span className="font-mono text-xs">{args.shipment.trackingNumber}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Order Confirmation Card ──────────────────────────────────────────────────

export function OrderConfirmationCard({ args }: { args: OrderConfirmationArgs }) {
  return (
    <Card variant="default" className="my-2 max-w-md border-l-4 border-l-m-success">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon name="check-circle" size="sm" className="text-m-success" />
          <CardTitle className="text-sm font-semibold">Order Confirmed</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Order</span>
          <span className="font-semibold">{args.orderNumber}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Customer</span>
          <span className="font-medium">{args.customer.name}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Items</span>
          <span className="font-medium">{args.itemCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Total</span>
          <span className="font-semibold text-m-text">{args.total}</span>
        </div>
        {args.paymentMethod && (
          <div className="flex justify-between text-xs">
            <span className="text-m-text-muted">Payment</span>
            <span>{args.paymentMethod}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cart Summary Card ────────────────────────────────────────────────────────

export function CartSummaryCard({ args }: { args: CartSummaryArgs }) {
  return (
    <Card variant="default" className="my-2 max-w-md">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold">Cart Summary</CardTitle>
        <p className="text-xs text-m-text-muted">{args.customer.name}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <div className="space-y-1">
          {args.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-m-text">
                {item.name} <span className="text-m-text-muted">×{item.quantity}</span>
              </span>
              <span className="font-medium">{item.lineTotal}</span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-m-border space-y-1">
          <div className="flex justify-between text-xs text-m-text-muted">
            <span>Subtotal</span><span>{args.subtotal}</span>
          </div>
          {args.discount && (
            <div className="flex justify-between text-xs text-m-success">
              <span>Discount</span><span>-{args.discount}</span>
            </div>
          )}
          {args.shipping && (
            <div className="flex justify-between text-xs text-m-text-muted">
              <span>Shipping</span><span>{args.shipping}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-semibold text-m-text pt-1">
            <span>Total</span><span>{args.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
// Compact fixed-width card designed for horizontal scroll rows.
// Width is fixed at 176px so all cards in a row are identical in size.

export function ProductCard({
  args,
  onAddToCart,
}: {
  args: ProductCardArgs;
  /** Optional AI hidden-action callback — when present, "Add" also sends the
   *  AI the order.add_item signal so the chat flow stays in sync. The cart
   *  itself is updated directly via CartStore (no AI round-trip needed). */
  onAddToCart?: (args: ProductCardArgs) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addDone, setAddDone] = useState(false);

  // Live cart state so the button reflects what's already in the cart.
  const cartItems = useCartStore((s) => s.items);
  const customer = useConversationStore((s) => s.customer);
  const cartItem = cartItems.find((i) => i.sku === args.sku);
  const inCart = !!cartItem;

  const stockIsOut = args.stock.toLowerCase().includes("out");
  const stockVariant = stockIsOut ? "error"
    : args.stock.toLowerCase().includes("low") ? "warning"
    : "success";
  const stockLabel = stockIsOut ? "Out of stock" : "In stock";

  const handleAdd = async () => {
    if (addBusy || stockIsOut) return;
    setAddBusy(true);
    const result = await useCartStore.getState().addItem({
      sku: args.sku,
      name: args.name,
      customerId: customer?.id ?? null,
      priceLabel: args.price,
    });
    setAddBusy(false);
    if (result.ok) {
      setAddDone(true);
      setTimeout(() => setAddDone(false), 2000);
      onAddToCart?.(args); // also tell the AI
    }
  };

  return (
    <>
      {/* Fixed width keeps all cards in the horizontal row the same size */}
      <div className="flex-shrink-0 w-44 rounded-m-xl border border-m-border bg-m-surface overflow-hidden flex flex-col shadow-m-xs hover:shadow-m-sm transition-shadow">

        {/* Image area — always rendered at a fixed height so cards align */}
        <div className="h-28 bg-m-surface-2 flex items-center justify-center overflow-hidden flex-shrink-0">
          {args.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={args.image} alt={args.name} className="w-full h-full object-contain p-2" />
          ) : (
            <Icon name="package" size="md" className="text-m-border opacity-50" />
          )}
        </div>

        {/* Body — flex-1 so footer always sits at the bottom */}
        <div className="px-3 pt-2.5 pb-2 flex flex-col flex-1 gap-1.5">
          <div className="flex-1">
            <p className="text-xs font-semibold text-m-text leading-snug line-clamp-2">{args.name}</p>
            <p className="text-[10px] text-m-text-muted font-mono mt-0.5 truncate">{args.sku}</p>
          </div>
          <div className="flex items-center justify-between gap-1 mt-1">
            <span className="text-sm font-bold text-m-text">{args.price}</span>
            <Badge variant={stockVariant} size="sm">{stockLabel}</Badge>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-3 pb-3 flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setDrawerOpen(true)}>
            Details
          </Button>
          {inCart ? (
            /* Already in cart — show View Cart shortcut */
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => useCartStore.getState().openCart()}
            >
              In Cart
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="flex-1 text-xs"
              disabled={addBusy || stockIsOut}
              onClick={() => void handleAdd()}
            >
              {addDone ? "✓ Added" : addBusy ? "…" : "Add"}
            </Button>
          )}
        </div>
      </div>

      <ProductDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        product={args}
        onAddToCart={onAddToCart ? () => onAddToCart(args) : undefined}
      />
    </>
  );
}

// ─── Case Briefing Card ───────────────────────────────────────────────────────

export function CaseBriefingCard({ args }: { args: CaseBriefingArgs }) {
  return (
    <Card variant="default" className="my-2">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Case Briefing</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={SENTIMENT_VARIANT[args.sentiment] ?? "default"} size="sm">
              {args.sentiment}
            </Badge>
            <span className="text-xs text-m-text-muted">{args.confidenceScore}% confidence</span>
          </div>
        </div>
        <p className="text-xs text-m-text-muted mt-0.5">{args.customerName}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-m-text-muted uppercase tracking-wide mb-1">
            Issue — {args.issueCategory}
          </p>
          <p className="text-xs text-m-text">{args.caseSummary}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-m-text-muted uppercase tracking-wide mb-1">Root Cause</p>
          <p className="text-xs text-m-text">{args.rootCause}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-m-text-muted uppercase tracking-wide mb-1">Recommended Resolution</p>
          <p className="text-xs text-m-text">{args.recommendedResolution}</p>
        </div>
        {args.suggestedActions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-m-text-muted uppercase tracking-wide mb-1">Next Steps</p>
            <ul className="space-y-0.5">
              {args.suggestedActions.map((action, i) => (
                <li key={i} className="text-xs text-m-text flex items-start gap-1.5">
                  <span className="text-m-primary mt-0.5">›</span>
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Draft Email Card ─────────────────────────────────────────────────────────

export function DraftEmailCard({ args }: { args: DraftEmailArgs }) {
  return (
    <Card variant="default" className="my-2 border-l-4 border-l-m-info">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon name="mail" size="sm" className="text-m-info" />
          <CardTitle className="text-sm font-semibold">Draft Email</CardTitle>
        </div>
        <p className="text-xs text-m-text-muted mt-0.5">Subject: {args.suggestedSubject}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-xs text-m-text bg-m-surface-2 rounded-m-md p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
          {args.draftContent}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Render Refund Card ───────────────────────────────────────────────────────

export function RenderRefundCard({
  args,
  onConfirm,
  onDecline,
  isPending
}: {
  args: RenderRefundActionArgs;
  onConfirm: () => void;
  onDecline: () => void;
  isPending?: boolean;
}) {
  return (
    <Card variant="default" className="my-2 max-w-md border-l-4 border-l-m-warning">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon name="rotate-ccw" size="sm" className="text-m-warning" />
          <CardTitle className="text-sm font-semibold">Return / Refund</CardTitle>
        </div>
        <p className="text-xs text-m-text-muted">Order {args.orderNumber}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <div>
          <p className="text-xs text-m-text-muted mb-1">Reason: <span className="text-m-text font-medium">{args.reason}</span></p>
        </div>
        <div className="space-y-1">
          {args.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span>{item.name}</span>
              <span className="text-m-text-muted">×{item.quantity}</span>
            </div>
          ))}
        </div>
        {/* Matches ActionApproval's approve/decline pattern used everywhere
            else in the chat — this card was the one place a rep had no way
            to back out of an in-flight approval, and its lone red button
            read as a destructive/dangerous action rather than a normal
            confirm step. Label is "Confirm" (not "Confirm Return") so it
            doesn't wrap to two lines in a 50/50 flex split like "Approve"
            doesn't on ActionApproval — the card title already says "Return
            / Refund", so the button doesn't need to repeat it. */}
        <div className="flex gap-2 mt-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={onConfirm}
            disabled={isPending}
            leftIcon={<Icon name="check" size="xs" />}
          >
            Confirm
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={onDecline}
            disabled={isPending}
            leftIcon={<Icon name="x" size="xs" />}
          >
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
