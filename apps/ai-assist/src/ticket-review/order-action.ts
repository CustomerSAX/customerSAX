import type { OrderAction, OrderFindings, ReviewOrder, ReviewTicket } from "./types.js";

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
  if (
    !Number.isInteger(order.version) ||
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
