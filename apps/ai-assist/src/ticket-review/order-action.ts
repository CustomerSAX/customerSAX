import type { OrderAction, OrderFindings, ReviewOrder, ReviewTicket } from "./types.js";

const normalized = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function prepareReturnAction(
  ticket: ReviewTicket,
  order: ReviewOrder,
  findings: OrderFindings
): { action?: OrderAction; reason?: string } {
  const source = normalized(`${ticket.subject}\n${ticket.message}`);
  const reason = findings.returnReason?.trim();
  const evidence = findings.returnReasonEvidence?.trim();
  if (
    !reason ||
    !evidence ||
    !source.includes(normalized(evidence)) ||
    !normalized(evidence).includes(normalized(reason))
  )
    return {
      reason:
        "The return reason must be stated by the customer before an executable return can be prepared."
    };
  if (
    ["Cancelled", "ReturnReceived"].includes(String(order.orderState)) ||
    !["Shipped", "Partial", "Delivered"].includes(String(order.shipmentState)) ||
    order.paymentState !== "Paid"
  )
    return {
      reason:
        "This order is not currently eligible for an automated return. It must be paid, shipped, and not cancelled or already fully returned."
    };
  const createdAt = Date.parse(String(order.createdAt ?? ""));
  const returnWindowDays = Number.parseInt(process.env.RETURN_WINDOW_DAYS ?? "30", 10);
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(returnWindowDays) ||
    Date.now() - createdAt > returnWindowDays * 86_400_000
  )
    return {
      reason:
        "The order is outside the configured return window, or its order date is unavailable. Review the applicable return policy manually."
    };

  const returned = new Map<string, number>();
  for (const info of (order.returnInfo as Array<{ items?: Array<{ lineItemId?: string; quantity?: number }> }> | undefined) ?? [])
    for (const item of info.items ?? [])
      if (item.lineItemId)
        returned.set(item.lineItemId, (returned.get(item.lineItemId) ?? 0) + (item.quantity ?? 0));
  const lines = new Map(
    ((order.lineItems as Array<{ id: string; name?: string; sku?: string; quantity?: number }> | undefined) ?? [])
      .map((item) => [item.id, item])
  );
  if (!findings.returnItems?.length)
    return {
      reason:
        "Identify the exact item and quantity to return before preparing the action."
    };
  const selected: Extract<OrderAction, { kind: "start_return" }>["lineItems"] = [];
  const selectedIds = new Set<string>();
  const quantityWords = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"
  ];
  for (const requested of findings.returnItems) {
    const line = lines.get(requested.lineItemId);
    const remaining = Math.max(0, (line?.quantity ?? 0) - (returned.get(requested.lineItemId) ?? 0));
    const itemEvidence = normalized(requested.evidence ?? "");
    const statedQuantity = new RegExp(
      `(?:^| )(${requested.quantity}|${quantityWords[requested.quantity] ?? "__none__"})(?: |$)`
    ).test(itemEvidence);
    if (
      !line ||
      selectedIds.has(requested.lineItemId) ||
      !line.name ||
      !itemEvidence ||
      !source.includes(itemEvidence) ||
      !itemEvidence.includes(normalized(line.name)) ||
      !Number.isInteger(requested.quantity) ||
      requested.quantity < 1 ||
      requested.quantity > remaining ||
      (remaining !== 1 && !statedQuantity)
    )
      return {
        reason:
          "The ticket must identify an exact returnable order item and an unambiguous quantity. Analyze again after the customer confirms those details."
      };
    selectedIds.add(requested.lineItemId);
    selected.push({
      lineItemId: line.id,
      quantity: requested.quantity,
      name: line.name,
      ...(line.sku ? { sku: line.sku } : {})
    });
  }
  return { action: { kind: "start_return", reason, lineItems: selected } };
}

export function prepareOrderAction(
  ticket: ReviewTicket,
  order: ReviewOrder,
  findings: OrderFindings
): { action?: OrderAction; reason?: string } {
  if (!findings.requestedAction) return {};
  if (!ticket.customerId || order.customerId !== ticket.customerId)
    return {
      reason:
        "Order findings are available through the verified customer email, but automated changes require the order to be linked to this customer account in commercetools. Verify and link the account or handle the change manually, then analyze again."
    };
  if (!Number.isInteger(order.version))
    return { reason: "The current order version is unavailable. Analyze again." };
  if (findings.requestedAction === "start_return")
    return prepareReturnAction(ticket, order, findings);
  if (
    !["Open", "Confirmed"].includes(String(order.orderState)) ||
    !["Pending", "Ready"].includes(String(order.shipmentState))
  )
    return {
      reason:
        "Order changes require an open or confirmed order awaiting shipment. Handle this request manually."
    };
  if (findings.requestedAction === "cancel_order") {
    if (order.paymentState !== "Pending" || order.hasPayments)
      return {
        reason: "Payment activity requires manual cancellation and refund review."
      };
    return { action: { kind: "cancel_order" } };
  }
  const address = findings.address;
  const source = `${ticket.subject}\n${ticket.message}`.normalize("NFKC").toLowerCase();
  if (
    !address ||
    !address.streetName?.trim() ||
    !address.city?.trim() ||
    !address.postalCode?.trim() ||
    !/^[A-Z]{2}$/.test(address.country ?? "") ||
    Object.values(address).some(
      (value) =>
        value.length > 300 ||
        (value && !source.includes(value.normalize("NFKC").toLowerCase()))
    )
  )
    return {
      reason:
        "Add the complete new address, including the two-letter country code, to the ticket. Address fields must come directly from the request."
    };
  const previous = order.shippingAddress as Record<string, unknown> | undefined;
  if (
    !previous ||
    ["country", "state", "postalCode"].some(
      (key) => (previous[key] ?? "") !== (address[key] ?? "")
    )
  )
    return {
      reason:
        "Changes to country, state, or postal code require manual tax and shipping review."
    };
  return { action: { kind: "change_shipping_address", address } };
}
