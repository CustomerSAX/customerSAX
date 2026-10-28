"use client";

/**
 * Order cards built from real tool results (ai-assist get_order and
 * get_refund_status) instead of values the model writes, so they appear every
 * time and show only what commercetools holds.
 */

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";
import { useConversationStore } from "../store/conversation-store";
import type { OrderSummaryArgs } from "../types";

type RawMoney = { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null | undefined;

function money(m: RawMoney): string {
  if (!m || typeof m.centAmount !== "number" || !m.currencyCode) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: m.currencyCode }).format(m.centAmount / 10 ** (m.fractionDigits ?? 2));
}

/** Orders from a get_order result (`{ order, orders }`) as order-card args — real values only. */
export function ordersFromGetOrder(output: unknown): OrderSummaryArgs[] {
  const o = output as { order?: unknown; orders?: unknown } | null;
  const list = Array.isArray(o?.orders) && o!.orders.length > 0 ? o!.orders : o?.order ? [o.order] : [];
  return (list as Array<Record<string, unknown>>).flatMap((order) => {
    if (typeof order?.id !== "string") return [];
    const lines = (order.lineItems as Array<{ quantity?: number }> | undefined) ?? [];
    const customer = order.customer as { name?: string; email?: string } | null | undefined;
    const email = (customer?.email ?? (order.customerEmail as string | undefined)) || undefined;
    const shipmentState = order.shipmentState as string | null | undefined;
    // Newest outbound parcel with a tracking id (deliveries come oldest first).
    const parcel = ((order.deliveries as Array<{ parcels?: Array<{ trackingId?: string | null; carrier?: string | null; isReturn?: boolean | null }> }> | undefined) ?? [])
      .flatMap((d) => d.parcels ?? [])
      .filter((p) => p.trackingId && !p.isReturn)
      .at(-1);
    return [{
      orderId: order.id,
      // Some orders genuinely have no order number — fall back to the real id, never invent one.
      orderNumber: (order.orderNumber as string | null | undefined) || order.id,
      status: ((order.orderState ?? order.state) as string | null | undefined) ?? "",
      date: (order.createdAt as string | undefined) ?? "",
      itemCount: lines.reduce((n, l) => n + (l.quantity ?? 0), 0),
      total: money(order.totalPrice as RawMoney),
      customer: { name: customer?.name || email || "", email },
      shipment: shipmentState
        ? { status: shipmentState, trackingNumber: parcel?.trackingId ?? undefined, carrier: parcel?.carrier ?? undefined }
        : undefined
    }];
  });
}

type RefundStatus = {
  orderId: string;
  orderNumber: string | null;
  orderState: string | null;
  paymentState: string | null;
  total: string | null;
  summary: string;
  payments: Array<{
    method: string | null;
    amountPlanned: string | null;
    transactions: Array<{ type: string | null; state: string | null; meaning: string | null; amount: string | null; date: string | null }>;
  }>;
  returns: Array<{
    date: string | null;
    trackingId: string | null;
    items: Array<{
      name: string | null;
      quantity: number;
      returnMeaning: string | null;
      refundStatus: string | null;
      refundMeaning: string | null;
      reason: string | null;
    }>;
  }>;
};

/** A get_refund_status result, or null when this isn't one. */
export function refundStatusFromOutput(output: unknown): RefundStatus | null {
  const r = output as Partial<RefundStatus> & { found?: boolean } | null;
  if (!r || r.found !== true || typeof r.orderId !== "string" || !Array.isArray(r.payments) || !Array.isArray(r.returns)) return null;
  return r as RefundStatus;
}

const refundVariant = (state: string | null) =>
  state === "Refunded" ? "success" : state === "Initial" ? "warning" : state ? "neutral" : "neutral";

export function RefundStatusCard({
  status,
  onSuggest,
  isLoading = false,
  editable = false
}: {
  status: RefundStatus;
  onSuggest?: (prompt: string) => void;
  isLoading?: boolean;
  /** Only the newest card is actionable; older ones are snapshots. */
  editable?: boolean;
}) {
  const canAct = editable && !!onSuggest;
  const orderRef = status.orderNumber ?? status.orderId;
  const awaitingRefund = status.returns.some((r) => r.items.some((i) => i.refundStatus === "Initial"));
  return (
    <Card variant="default" className="my-2 w-full max-w-md">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon name="receipt" size="xs" className="text-m-primary" />
          Payment & refunds
        </CardTitle>
        <p className="text-xs text-m-text-muted">
          Order {status.orderNumber ?? status.orderId}
          {status.total ? ` · ${status.total}` : ""}
          {status.paymentState ? ` · payment ${status.paymentState}` : ""}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3 text-xs">
        <div>
          <p className="font-semibold text-m-text mb-1">Payments</p>
          {status.payments.length === 0 ? (
            <p className="text-m-text-muted">No payment record is attached to this order.</p>
          ) : (
            status.payments.map((p, i) => (
              <div key={i} className="space-y-1">
                <p className="text-m-text">
                  {p.method ?? "Method not recorded"}
                  {p.amountPlanned ? <span className="text-m-text-muted"> · {p.amountPlanned}</span> : null}
                </p>
                {p.transactions.length === 0 ? (
                  <p className="text-m-text-muted">No transactions.</p>
                ) : (
                  p.transactions.map((t, j) => (
                    <div key={j} className="flex items-center justify-between gap-2">
                      <span className="text-m-text">
                        {t.type ?? "Transaction"} {t.date ? <span className="text-m-text-muted">· {t.date}</span> : null}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {t.amount && <span className="tabular-nums">{t.amount}</span>}
                        <Badge variant={t.state === "Success" ? "success" : t.state === "Failure" ? "error" : "warning"} size="sm">
                          {t.meaning ?? t.state ?? "unknown"}
                        </Badge>
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
        <div className="pt-2 border-t border-m-border">
          <p className="font-semibold text-m-text mb-1">Returns</p>
          {status.returns.length === 0 ? (
            <p className="text-m-text-muted">No return has been recorded for this order.</p>
          ) : (
            <div className="space-y-2">
              {status.returns.map((r, i) => (
                <div key={i} className="rounded-m-md border border-m-border p-2 space-y-1">
                  <p className="text-m-text-muted">
                    {r.date ? `Returned ${r.date}` : "Return"}
                    {r.trackingId ? ` · tracking ${r.trackingId}` : ""}
                  </p>
                  {r.items.map((item, j) => (
                    <div key={j} className="flex items-start justify-between gap-2">
                      <span className="text-m-text min-w-0">
                        {item.quantity}× {item.name ?? "Item"}
                        {item.returnMeaning && <span className="block text-m-text-muted">{item.returnMeaning}</span>}
                        {item.reason && <span className="block text-m-text-muted italic">{item.reason}</span>}
                      </span>
                      <Badge variant={refundVariant(item.refundStatus)} size="sm">
                        {item.refundMeaning ?? item.refundStatus ?? "refund status unknown"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        {canAct && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-m-border">
            <Button
              size="sm"
              variant="outline"
              // Same rule as the order card: a return needs a paid order.
              disabled={isLoading || status.paymentState !== "Paid"}
              title={status.paymentState !== "Paid" ? `Payment is ${status.paymentState ?? "not recorded"}; a return needs a paid order.` : undefined}
              leftIcon={<Icon name="rotate-ccw" size="xs" />}
              onClick={() => onSuggest!(`[hidden-action] ${JSON.stringify({ type: "order.start_return", orderId: status.orderId, orderNumber: orderRef })}`)}
            >
              Start return
            </Button>
            <Button
              size="sm"
              variant={awaitingRefund ? "primary" : "outline"}
              disabled={isLoading}
              leftIcon={<Icon name="ticket" size="xs" />}
              onClick={() => {
                useConversationStore.getState().setActiveStepper("ticket");
                useConversationStore.getState().setTicketWorkflow(null);
                onSuggest!(
                  awaitingRefund
                    ? `Create a support ticket to chase the refund for order ${orderRef}: returned item(s) are not refunded yet.`
                    : `Create a support ticket for order ${orderRef} about its payment / refund.`
                );
              }}
            >
              {awaitingRefund ? "Create ticket to chase refund" : "Create ticket"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              leftIcon={<Icon name="mail" size="xs" />}
              onClick={() => onSuggest!(`[hidden-action] ${JSON.stringify({ type: "order.draft_update", orderId: status.orderId, orderNumber: orderRef, topic: "refund" })}`)}
            >
              Draft refund update
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ReturnForm = {
  orderId: string;
  orderNumber: string | null;
  daysRemaining: number | null;
  lineItems: Array<{ lineItemId: string; name: string; sku: string | null; price: string | null; quantity: number; returnable: number }>;
  reasons: Array<{ id: string; label: string }>;
  /** Reason the rep already gave in the conversation — pre-selected, still changeable. */
  suggestedReason: string | null;
  /** Lines the rep already named ("the jacket") — pre-ticked, still changeable. */
  suggestedLineItemIds: string[];
};

/** An eligible check_return_eligibility result as a return form, or null when it isn't one. */
export function returnFormFromOutput(output: unknown): ReturnForm | null {
  const r = output as {
    eligible?: boolean;
    daysRemaining?: number;
    suggestedReason?: string | null;
    suggestedLineItemIds?: unknown;
    returnReasons?: Array<{ id?: unknown; label?: unknown }>;
    order?: { id?: unknown; orderNumber?: string | null; lineItems?: Array<Record<string, unknown>> };
  } | null;
  if (!r || r.eligible !== true || typeof r.order?.id !== "string" || !Array.isArray(r.order.lineItems) || !Array.isArray(r.returnReasons)) return null;
  const lineItems = r.order.lineItems.flatMap((li) =>
    typeof li.lineItemId === "string" && li.lineItemId
      ? [{
          lineItemId: li.lineItemId,
          name: typeof li.name === "string" ? li.name : li.lineItemId,
          sku: typeof li.sku === "string" ? li.sku : null,
          price: typeof li.price === "string" && li.price ? li.price : null,
          quantity: typeof li.quantity === "number" ? li.quantity : 0,
          returnable: typeof li.returnableQuantity === "number" ? li.returnableQuantity : typeof li.quantity === "number" ? li.quantity : 0
        }]
      : []
  );
  const reasons = r.returnReasons.flatMap((x) => (typeof x.id === "string" && typeof x.label === "string" ? [{ id: x.id, label: x.label }] : []));
  if (lineItems.length === 0 || reasons.length === 0) return null;
  const suggestedReason = reasons.some((x) => x.id === r.suggestedReason) ? r.suggestedReason! : null;
  const suggestedLineItemIds = Array.isArray(r.suggestedLineItemIds)
    ? r.suggestedLineItemIds.filter((id): id is string => typeof id === "string" && lineItems.some((li) => li.lineItemId === id))
    : [];
  return { orderId: r.order.id, orderNumber: r.order.orderNumber ?? null, daysRemaining: r.daysRemaining ?? null, lineItems, reasons, suggestedReason, suggestedLineItemIds };
}

const qtyButton =
  "h-6 w-6 inline-flex items-center justify-center rounded-m-sm border border-m-border text-m-text hover:bg-m-surface-2 disabled:opacity-40 disabled:cursor-default";

/**
 * Pick what to return: items (checkbox + quantity, capped at what is still
 * returnable), a reason (radio buttons) and an optional note. Submitting sends
 * one `return.confirm` — the rep's approval for this order, checked server-side.
 */
export function ReturnRequestCard({
  form,
  onSuggest,
  isLoading = false,
  editable = false
}: {
  form: ReturnForm;
  onSuggest?: (prompt: string) => void;
  isLoading?: boolean;
  /** Only the newest card is actionable; older ones are snapshots. */
  editable?: boolean;
}) {
  const canAct = editable && !!onSuggest;
  const returnable = form.lineItems.filter((li) => li.returnable > 0);
  // Pre-select the lines the rep named, or the only returnable line.
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const start = form.suggestedLineItemIds.length
      ? returnable.filter((li) => form.suggestedLineItemIds.includes(li.lineItemId))
      : returnable.length === 1 ? returnable : [];
    return Object.fromEntries(start.map((li) => [li.lineItemId, li.returnable]));
  });
  const [reason, setReason] = useState(form.suggestedReason ?? "");
  const [note, setNote] = useState("");
  const orderRef = form.orderNumber ?? form.orderId;
  const picked = form.lineItems.filter((li) => (qty[li.lineItemId] ?? 0) > 0);
  const units = picked.reduce((n, li) => n + qty[li.lineItemId], 0);
  const ready = picked.length > 0 && !!reason;

  const toggle = (li: ReturnForm["lineItems"][number]) =>
    setQty((q) => {
      const next = { ...q };
      if (next[li.lineItemId]) delete next[li.lineItemId];
      else next[li.lineItemId] = li.returnable;
      return next;
    });
  const setLineQty = (id: string, n: number) => setQty((q) => ({ ...q, [id]: n }));

  const submit = () =>
    onSuggest!(
      `[hidden-action] ${JSON.stringify({
        type: "return.confirm",
        orderId: form.orderId,
        orderNumber: orderRef,
        reason,
        ...(note.trim() ? { comment: note.trim() } : {}),
        lineItems: picked.map((li) => ({ lineItemId: li.lineItemId, quantity: qty[li.lineItemId], name: li.name }))
      })}`
    );

  return (
    <Card variant="default" className="my-2 w-full max-w-md">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon name="rotate-ccw" size="xs" className="text-m-primary" />
          Return items
        </CardTitle>
        <p className="text-xs text-m-text-muted">
          Order {orderRef}
          {form.daysRemaining !== null ? ` · ${form.daysRemaining} day${form.daysRemaining === 1 ? "" : "s"} left to return` : ""}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3 text-xs">
        <fieldset disabled={!canAct || isLoading} className="space-y-1.5">
          <legend className="font-semibold text-m-text mb-1">Items</legend>
          {form.lineItems.map((li) => {
            const selected = (qty[li.lineItemId] ?? 0) > 0;
            const done = li.returnable === 0;
            const detail = [
              li.sku,
              li.price,
              done ? "already returned" : li.returnable < li.quantity ? `${li.returnable} of ${li.quantity} still returnable` : `ordered ×${li.quantity}`
            ].filter(Boolean).join(" · ");
            return (
              <div key={li.lineItemId} className="flex items-center justify-between gap-2">
                <label className={`flex items-start gap-2 min-w-0 ${done ? "opacity-50" : "cursor-pointer"}`}>
                  <input type="checkbox" className="mt-0.5 accent-m-primary" checked={selected} disabled={done} onChange={() => toggle(li)} />
                  <span className="min-w-0">
                    <span className="text-m-text">{li.name}</span>
                    <span className="block text-m-text-muted">{detail}</span>
                  </span>
                </label>
                {selected && (
                  <span className="flex items-center gap-1 shrink-0" role="group" aria-label={`Quantity of ${li.name} to return`}>
                    <button
                      type="button"
                      aria-label={`Decrease ${li.name}`}
                      className={qtyButton}
                      disabled={!canAct || isLoading || qty[li.lineItemId] <= 1}
                      onClick={() => setLineQty(li.lineItemId, qty[li.lineItemId] - 1)}
                    >
                      <Icon name="minus" size="xs" />
                    </button>
                    <span className="min-w-[1.25rem] text-center font-medium tabular-nums">{qty[li.lineItemId]}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${li.name}`}
                      className={qtyButton}
                      disabled={!canAct || isLoading || qty[li.lineItemId] >= li.returnable}
                      onClick={() => setLineQty(li.lineItemId, qty[li.lineItemId] + 1)}
                    >
                      <Icon name="plus" size="xs" />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </fieldset>

        <fieldset disabled={!canAct || isLoading} className="pt-2 border-t border-m-border">
          <legend className="font-semibold text-m-text mb-1 pt-2">Reason</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {form.reasons.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer text-m-text">
                <input
                  type="radio"
                  name={`return-reason-${form.orderId}`}
                  className="accent-m-primary"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>

        {canAct && (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isLoading}
              rows={2}
              maxLength={500}
              placeholder="Note (optional)"
              className="w-full rounded-m-md border border-m-border bg-m-surface px-2 py-1.5 text-xs text-m-text placeholder:text-m-text-muted focus:outline-none focus:ring-1 focus:ring-m-primary"
            />
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-m-border">
              <span className="text-m-text-muted">
                {picked.length === 0 ? "Pick at least one item" : !reason ? "Pick a reason" : `${units} unit${units === 1 ? "" : "s"} selected`}
              </span>
              <Button size="sm" variant="primary" disabled={isLoading || !ready} leftIcon={<Icon name="rotate-ccw" size="xs" />} onClick={submit}>
                Start return
              </Button>
            </div>
            <p className="text-m-text-muted">Records the return on the order. Any refund is handled in the payment provider.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
