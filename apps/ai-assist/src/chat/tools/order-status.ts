/**
 * Refund & payment status for an order — "where's my refund?".
 *
 * Read-only. Combines the order, its payments (with transactions) and its
 * returns into one result, with plain-language meanings for every
 * commercetools state so the assistant can answer without guessing. Nothing is
 * inferred: if no refund transaction exists, the result says so. The studio
 * renders this result as a refund-status card.
 */

import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { bffQuery, formatMoney } from "../../commerce/graphql-client.js";
import { lookupOrder } from "./commerce.js";
import { instrumentTools } from "./instrument.js";

const log = createLogger("ai-assist").child({ module: "tools/order-status" });

type Money = { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null | undefined;

/** commercetools ReturnPaymentState */
const REFUND_STATE: Record<string, string> = {
  Initial: "not refunded yet",
  Refunded: "refunded",
  NotRefunded: "will not be refunded",
  NonRefundable: "not refundable"
};
/** commercetools ReturnShipmentState */
const RETURN_STATE: Record<string, string> = {
  Advised: "return announced, item not received yet",
  Returned: "item received back",
  BackInStock: "item received and restocked",
  Unusable: "item received but unusable"
};
/** commercetools TransactionState */
const TX_STATE: Record<string, string> = {
  Initial: "not started",
  Pending: "pending",
  Success: "succeeded",
  Failure: "failed"
};

type PaymentsResult = {
  order: {
    paymentInfo: {
      payments: Array<{
        amountPlanned?: Money;
        paymentMethodInfo?: { method?: string | null; name?: string | null } | null;
        transactions?: Array<{ timestamp?: string | null; type?: string; state?: string; amount?: Money }>;
      }>;
    } | null;
  } | null;
};
type ReturnsResult = {
  order: {
    lineItems?: Array<{ id: string; nameAllLocales?: Array<{ value: string }>; variant?: { sku?: string | null } }>;
    returnInfo?: Array<{
      returnDate?: string | null;
      returnTrackingId?: string | null;
      items: Array<{ quantity: number; shipmentState?: string; paymentState?: string; comment?: string | null; lineItemId?: string }>;
    }> | null;
  } | null;
};

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);

export function buildOrderStatusTools() {
  const getRefundStatus = tool({
    description:
      "Refund and payment status of an order: payment method, every payment transaction (charge, refund…) with its state, and every return " +
      "with each item's return and refund status. Use for 'where's my refund?', 'was I charged?', 'did my return arrive?'. " +
      "The studio shows the result as a refund-status card — answer in 1-2 sentences from `summary` and never claim a refund the result doesn't show.",
    inputSchema: z.object({
      orderId: z.string().optional().describe("Order id"),
      orderNumber: z.string().optional().describe("Order number, if the id isn't known")
    }),
    execute: async ({ orderId, orderNumber }) => {
      const id = orderId?.trim() || undefined;
      const number = orderNumber?.trim() || undefined;
      if (!id && !number) return { error: "Give an order id or order number." };
      try {
        const order = await lookupOrder({ orderId: id, orderNumber: number });
        if (!order) return { found: false, message: "No order matches that id or number." };
        const oid = order.id as string;
        const [payData, retData] = await Promise.all([
          bffQuery<{ orderPayments: PaymentsResult }>(`query OrderPayments($id: ID!) { orderPayments(id: $id) }`, { id: oid }),
          bffQuery<{ orderReturns: ReturnsResult }>(`query OrderReturns($id: ID!) { orderReturns(id: $id) }`, { id: oid })
        ]);

        const payments = (payData.orderPayments?.order?.paymentInfo?.payments ?? []).map((p) => ({
          method: p.paymentMethodInfo?.name || p.paymentMethodInfo?.method || null,
          amountPlanned: p.amountPlanned ? formatMoney(p.amountPlanned) : null,
          transactions: (p.transactions ?? []).map((t) => ({
            type: t.type ?? null,
            state: t.state ?? null,
            meaning: (t.state && TX_STATE[t.state]) ?? null,
            amount: t.amount ? formatMoney(t.amount) : null,
            date: day(t.timestamp)
          }))
        }));

        const names = new Map(
          (retData.orderReturns?.order?.lineItems ?? []).map((li) => [li.id, li.nameAllLocales?.[0]?.value ?? li.variant?.sku ?? li.id])
        );
        const returns = (retData.orderReturns?.order?.returnInfo ?? []).map((r) => ({
          date: day(r.returnDate),
          trackingId: r.returnTrackingId ?? null,
          items: r.items.map((i) => ({
            name: (i.lineItemId && names.get(i.lineItemId)) ?? null,
            quantity: i.quantity,
            returnStatus: i.shipmentState ?? null,
            returnMeaning: (i.shipmentState && RETURN_STATE[i.shipmentState]) ?? null,
            refundStatus: i.paymentState ?? null,
            refundMeaning: (i.paymentState && REFUND_STATE[i.paymentState]) ?? null,
            reason: i.comment ?? null
          }))
        }));

        // Facts only — built from the states above, nothing estimated.
        const refundTx = payments.flatMap((p) => p.transactions).filter((t) => t.type === "Refund");
        const returnedItems = returns.flatMap((r) => r.items);
        const awaitingRefund = returnedItems.filter((i) => i.refundStatus === "Initial").length;
        const refundedItems = returnedItems.filter((i) => i.refundStatus === "Refunded").length;
        const summary: string[] = [];
        summary.push(
          payments.length === 0
            ? "No payment record is attached to this order."
            : `Payment: ${payments.map((p) => `${p.method ?? "method not recorded"} ${p.transactions.map((t) => `${t.type} ${t.meaning ?? t.state}`).join(", ") || "with no transactions"}`).join("; ")}.`
        );
        summary.push(
          refundTx.length === 0
            ? "No refund transaction has been recorded."
            : `Refund transactions: ${refundTx.map((t) => `${t.amount ?? "amount not recorded"} ${t.meaning ?? t.state}${t.date ? ` (${t.date})` : ""}`).join(", ")}.`
        );
        if (returns.length === 0) summary.push("No return has been recorded for this order.");
        else
          summary.push(
            `${returnedItems.length} returned item(s) across ${returns.length} return(s)` +
              (awaitingRefund ? `; ${awaitingRefund} not refunded yet` : "") +
              (refundedItems ? `; ${refundedItems} refunded` : "") +
              "."
          );

        log.info("tool get_refund_status", { targetId: oid, returns: returns.length, payments: payments.length });
        return {
          found: true,
          orderId: oid,
          orderNumber: (order.orderNumber as string | null | undefined) ?? null,
          orderState: (order.orderState as string | null | undefined) ?? (order.state as string | null | undefined) ?? null,
          paymentState: (order.paymentState as string | null | undefined) ?? null,
          total: order.totalPrice ? formatMoney(order.totalPrice as Money) : null,
          payments,
          returns,
          summary: summary.join(" ")
        };
      } catch (err) {
        return { error: String(err) };
      }
    }
  });

  return instrumentTools({ get_refund_status: getRefundStatus }, log);
}
