"use client";

import { useEffect, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@csa/ui";
import { ProductDetailDrawer } from "./ProductDetailDrawer";
import { useCartStore } from "../store/cart-store";
import { useConversationStore } from "../store/conversation-store";
import { CrmBriefingStrip } from "./CrmCards";
import { LiveTicketActions } from "./TicketCards";
import type {
  CartSummaryArgs,
  CaseBriefingArgs,
  DraftEmailArgs,
  OrderConfirmationArgs,
  OrderSummaryArgs,
  ProductCardArgs,
  RenderRefundActionArgs,
  ApprovalResolution
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

// Live order state decides which actions are offered — never the values the
// model wrote into the card args.
const ORDER_CARD_LIVE_QUERY = gql`
  query OrderCardLive($id: ID) {
    order(id: $id) {
      id
      orderNumber
      orderState
      shipmentState
      paymentState
    }
  }
`;

interface OrderCardLive {
  id: string;
  orderNumber?: string | null;
  orderState?: string | null;
  shipmentState?: string | null;
  paymentState?: string | null;
}

// commercetools ShipmentState values that mean goods actually left the warehouse.
const SHIPPED_STATES = new Set(["Shipped", "Partial"]);

/** Why cancel / return are unavailable for this order, or null when allowed. */
function orderActionBlocks(live: OrderCardLive) {
  const cancelled = live.orderState === "Cancelled";
  const shipped = !!live.shipmentState && SHIPPED_STATES.has(live.shipmentState);
  const cancel = cancelled
    ? "This order is already cancelled."
    : live.orderState === "Complete"
      ? "This order is complete, so it can't be cancelled."
      : shipped
        ? "This order has shipped, so start a return instead of cancelling."
        : null;
  const ret = cancelled
    ? "This order is cancelled, so there's nothing to return."
    : !shipped
      ? `Nothing has shipped yet (shipment: ${live.shipmentState ?? "none"}), so there's nothing to return.`
      : live.paymentState !== "Paid"
        ? `Payment is ${live.paymentState ?? "not recorded"}; a return needs a paid order.`
        : null;
  return { cancel, ret };
}

/** Reads the order live and re-reads after every assistant turn. */
function useLiveOrder(orderId: string, isLoading: boolean) {
  const { data, error, loading, refetch } = useQuery<{ order: OrderCardLive | null }>(ORDER_CARD_LIVE_QUERY, {
    variables: { id: orderId },
    skip: !orderId,
    fetchPolicy: "cache-and-network"
  });
  useEffect(() => {
    if (!isLoading && orderId) void refetch().catch(() => undefined);
  }, [isLoading, orderId, refetch]);
  const live = data?.order ?? null;
  return { live, error, loading, blocks: live ? orderActionBlocks(live) : null };
}

function orderStatusVariant(status: string | null | undefined) {
  return status === "Complete" ? "success"
    : status === "Cancelled" ? "error"
    : status === "Shipped" ? "info"
    : "neutral";
}

/** "8 Sep 2026" for ISO timestamps; anything else is shown as given. */
function formatOrderDate(value: string) {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Long migrated order numbers are shortened; the full value stays in the tooltip. */
function shortOrderNumber(value: string) {
  return value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-6)}` : value;
}

function OrderActionButtons({
  args,
  orderNumber,
  live,
  blocks,
  error,
  loading,
  onSuggest,
  isLoading
}: {
  args: OrderSummaryArgs;
  orderNumber: string;
} & ReturnType<typeof useLiveOrder> & { onSuggest: (prompt: string) => void; isLoading: boolean }) {
  const send = (type: string) =>
    onSuggest(`[hidden-action] ${JSON.stringify({ type, orderId: args.orderId, orderNumber })}`);
  const note = blocks?.cancel && blocks.ret ? blocks.cancel : blocks?.cancel ?? blocks?.ret ?? null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => send("order.cancel")}
          disabled={isLoading || !blocks || !!blocks.cancel}
          title={blocks?.cancel ?? undefined}
          leftIcon={<Icon name="x-circle" size="xs" />}
        >
          Cancel order
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => send("order.start_return")}
          disabled={isLoading || !blocks || !!blocks.ret}
          title={blocks?.ret ?? undefined}
          leftIcon={<Icon name="rotate-ccw" size="xs" />}
        >
          Start return
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => send("order.reorder")}
          disabled={isLoading}
          leftIcon={<Icon name="shopping-cart" size="xs" />}
        >
          Reorder
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            useConversationStore.getState().setActiveStepper("ticket");
            useConversationStore.getState().setTicketWorkflow(null);
            onSuggest(`Create a support ticket for ${args.customer.name} — order ${orderNumber}`);
          }}
          disabled={isLoading}
          leftIcon={<Icon name="ticket" size="xs" />}
        >
          Create ticket
        </Button>
      </div>
      {loading && !live && <p className="text-[11px] text-m-text-muted">Checking the order&apos;s live status…</p>}
      {error && !live && (
        <p className="text-[11px] text-m-error">
          Couldn&apos;t load the live order status ({error.message}), so cancel and return are unavailable.
        </p>
      )}
      {note && <p className="text-[11px] text-m-text-muted">{note}</p>}
    </div>
  );
}

export function OrderSummaryCard({
  args,
  onSuggest = () => {},
  isLoading = false
}: {
  args: OrderSummaryArgs;
  onSuggest?: (prompt: string) => void;
  isLoading?: boolean;
}) {
  const liveOrder = useLiveOrder(args.orderId, isLoading);
  const { live } = liveOrder;
  const status = live?.orderState ?? args.status;
  const orderNumber = live?.orderNumber || args.orderNumber;
  const shipment = live?.shipmentState ?? args.shipment?.status;

  return (
    <Card variant="default" className="my-2 max-w-md">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="min-w-0 truncate text-sm font-semibold" title={orderNumber}>
            Order {shortOrderNumber(orderNumber)}
          </CardTitle>
          <Badge variant={orderStatusVariant(status)} size="sm">{status}</Badge>
        </div>
        <p className="text-xs text-m-text-muted mt-0.5">{args.customer.name}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Date</span>
          <span className="font-medium">{formatOrderDate(args.date)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Items</span>
          <span className="font-medium">{args.itemCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-m-text-muted">Total</span>
          <span className="font-semibold text-m-text">{args.total}</span>
        </div>
        {live?.paymentState && (
          <div className="flex justify-between text-xs">
            <span className="text-m-text-muted">Payment</span>
            <span className="font-medium">{live.paymentState}</span>
          </div>
        )}
        {shipment && (
          <div className="pt-1.5 border-t border-m-border flex justify-between text-xs">
            <span className="text-m-text-muted">Shipment</span>
            <span className="font-medium">{shipment}</span>
          </div>
        )}
        {args.shipment?.trackingNumber && (
          <div className="flex justify-between text-xs">
            <span className="text-m-text-muted">Tracking</span>
            <span className="font-mono text-xs">{args.shipment.trackingNumber}</span>
          </div>
        )}
        <div className="pt-2.5 mt-1 border-t border-m-border">
          <OrderActionButtons args={args} orderNumber={orderNumber} {...liveOrder} onSuggest={onSuggest} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Orders Table (several orders in one reply) ──────────────────────────────

function OrderTableRow({
  args,
  expanded,
  onToggle,
  onSuggest,
  isLoading
}: {
  args: OrderSummaryArgs;
  expanded: boolean;
  onToggle: () => void;
  onSuggest: (prompt: string) => void;
  isLoading: boolean;
}) {
  const liveOrder = useLiveOrder(args.orderId, isLoading);
  const { live } = liveOrder;
  const status = live?.orderState ?? args.status;
  const orderNumber = live?.orderNumber || args.orderNumber;
  const shipment = live?.shipmentState ?? args.shipment?.status ?? "—";

  return (
    <>
      <TableRow selected={expanded}>
        <TableCell className="font-medium text-m-text" title={orderNumber}>
          {shortOrderNumber(orderNumber)}
        </TableCell>
        <TableCell className="whitespace-nowrap">{formatOrderDate(args.date)}</TableCell>
        <TableCell className="text-right">{args.itemCount}</TableCell>
        <TableCell className="whitespace-nowrap text-right font-semibold text-m-text">{args.total}</TableCell>
        <TableCell>
          <Badge variant={orderStatusVariant(status)} size="sm">{status}</Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">{shipment}</TableCell>
        <TableCell className="text-right">
          <Button
            size="sm"
            variant={expanded ? "secondary" : "ghost"}
            onClick={onToggle}
            aria-expanded={expanded}
            rightIcon={<Icon name={expanded ? "chevron-up" : "chevron-down"} size="xs" />}
          >
            Actions
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-m-surface-2/40">
            <OrderActionButtons args={args} orderNumber={orderNumber} {...liveOrder} onSuggest={onSuggest} isLoading={isLoading} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function OrderSummaryTable({
  orders,
  onSuggest,
  isLoading
}: {
  orders: OrderSummaryArgs[];
  onSuggest: (prompt: string) => void;
  isLoading: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const customers = Array.from(new Set(orders.map((o) => o.customer?.name).filter(Boolean)));

  return (
    <div className="my-2 w-full space-y-1.5">
      <p className="text-xs text-m-text-muted">
        {orders.length} orders{customers.length === 1 ? ` · ${customers[0]}` : ""}
      </p>
      <Table aria-label="Orders">
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Shipment</TableHead>
            <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <OrderTableRow
              key={order.orderId}
              args={order}
              expanded={expandedId === order.orderId}
              onToggle={() => setExpandedId((id) => (id === order.orderId ? null : order.orderId))}
              onSuggest={onSuggest}
              isLoading={isLoading}
            />
          ))}
        </TableBody>
      </Table>
    </div>
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

  // No inventory record means the stock is unknown — say so rather than "In stock".
  const stockText = args.stock?.trim() ?? "";
  const stockIsOut = stockText.toLowerCase().includes("out");
  const stockVariant = !stockText ? "neutral"
    : stockIsOut ? "error"
    : stockText.toLowerCase().includes("low") ? "warning"
    : "success";
  const stockLabel = !stockText ? "Stock unknown" : stockIsOut ? "Out of stock" : "In stock";

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
            {args.price
              ? <span className="text-sm font-bold text-m-text">{args.price}</span>
              : <span className="text-xs text-m-text-muted">No price</span>}
            <Badge variant={stockVariant} size="sm">{stockLabel}</Badge>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-3 pb-3 flex flex-col gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs w-full" onClick={() => setDrawerOpen(true)}>
            Details
          </Button>
          {inCart ? (
            /* Already in cart — show View Cart shortcut */
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs w-full"
              onClick={() => useCartStore.getState().openCart()}
            >
              In Cart
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="flex-1 text-xs w-full"
              disabled={addBusy || stockIsOut}
              onClick={() => void handleAdd()}
            >
              {addDone ? "✓ Added" : addBusy ? "…" : "Add to Cart"}
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

export function CaseBriefingCard({
  args,
  onSuggest,
  isLoading = false
}: {
  args: CaseBriefingArgs;
  onSuggest?: (prompt: string) => void;
  isLoading?: boolean;
}) {
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
        {args.crmContactId && <CrmBriefingStrip contactId={args.crmContactId} />}
        {args.ticketId && onSuggest && (
          <div className="pt-3 border-t border-m-border">
            <LiveTicketActions ticketId={args.ticketId} onSuggest={onSuggest} isLoading={isLoading} />
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
  isPending,
  resolution = null
}: {
  args: RenderRefundActionArgs;
  onConfirm: () => void;
  onDecline: () => void;
  isPending?: boolean;
  resolution?: ApprovalResolution;
}) {
  return (
    <Card variant="default" className="my-2 max-w-md border-l-4 border-l-m-warning">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon name="rotate-ccw" size="sm" className="text-m-warning" />
          <CardTitle className="text-sm font-semibold">Return / Refund</CardTitle>
          {resolution && (
            <Badge variant={resolution === "approved" ? "success" : "neutral"} size="sm" className="ml-auto">
              {resolution === "approved" ? "Confirmed" : resolution === "declined" ? "Declined" : "No longer pending"}
            </Badge>
          )}
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
        {!resolution && <div className="flex gap-2 mt-2">
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
        </div>}
      </CardContent>
    </Card>
  );
}
