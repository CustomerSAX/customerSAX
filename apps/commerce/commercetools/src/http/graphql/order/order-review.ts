import { getCommercetoolsToken } from "../../../commercetools/auth.js";
import { resolveCommercetoolsProject } from "../../../commercetools/project-config.js";

type Order = {
  id: string;
  version: number;
  customerId?: string;
  customerEmail?: string;
  orderNumber?: string;
  orderState?: string;
  shipmentState?: string;
  paymentState?: string;
  shippingAddress?: Record<string, unknown>;
  [key: string]: unknown;
};
async function request(path: string, body?: unknown): Promise<Order> {
  const config = await resolveCommercetoolsProject();
  const token = await getCommercetoolsToken(config);
  const response = await fetch(`${config.apiUrl}/${config.projectKey}/orders/${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok)
    throw Object.assign(
      new Error(
        `Order request failed (${response.status}). Refresh the proposal before retrying.`
      ),
      { status: response.status }
    );
  return response.json() as Promise<Order>;
}
export async function orderReviewSnapshot(reference: string) {
  let order: Order;
  try {
    order = await request(`order-number=${encodeURIComponent(reference)}`);
  } catch (error) {
    if (
      (error as { status?: number }).status !== 404 ||
      !/^[0-9a-f-]{36}$/i.test(reference)
    )
      throw error;
    order = await request(encodeURIComponent(reference));
  }
  const {
    id,
    version,
    customerId,
    customerEmail,
    orderNumber,
    orderState,
    shipmentState,
    paymentState,
    shippingAddress,
    lastModifiedAt,
    totalPrice,
    lineItems
  } = order;
  return {
    hasPayments: Boolean(
      (order.paymentInfo as { payments?: unknown[] } | undefined)?.payments?.length
    ),
    id,
    version,
    customerId,
    customerEmail,
    orderNumber,
    orderState,
    shipmentState,
    paymentState,
    shippingAddress,
    lastModifiedAt,
    totalPrice,
    lineItems
  };
}
export async function updateReviewedOrder(args: {
  id: string;
  customerId: string;
  expectedVersion: number;
  action: { kind: string; address?: Record<string, string> };
}) {
  const order = await request(encodeURIComponent(args.id));
  if (order.customerId !== args.customerId || order.version !== args.expectedVersion)
    throw new Error("The customer or order version changed. Prepare a new proposal.");
  if (
    !["Open", "Confirmed"].includes(order.orderState ?? "") ||
    !["Pending", "Ready"].includes(order.shipmentState ?? "")
  )
    throw new Error(
      "Only open or confirmed orders awaiting shipment support this action."
    );
  let action: Record<string, unknown>;
  if (args.action.kind === "cancel_order") {
    if (
      order.paymentState !== "Pending" ||
      (order.paymentInfo as { payments?: unknown[] } | undefined)?.payments?.length
    )
      throw new Error("Cancellation with payment activity requires manual review.");
    action = { action: "changeOrderState", orderState: "Cancelled" };
  } else if (args.action.kind === "change_shipping_address") {
    const address = args.action.address;
    const allowed = [
      "streetName",
      "streetNumber",
      "city",
      "state",
      "postalCode",
      "country"
    ];
    if (
      !address ||
      Object.keys(address).some((key) => !allowed.includes(key)) ||
      Object.values(address).some(
        (value) => typeof value !== "string" || value.length > 300
      ) ||
      !address.streetName?.trim() ||
      !address.city?.trim() ||
      !address.postalCode?.trim() ||
      !/^[A-Z]{2}$/.test(address.country ?? "")
    )
      throw new Error("A complete shipping address is required.");
    if (
      !order.shippingAddress ||
      ["country", "state", "postalCode"].some(
        (key) => (address[key] ?? "") !== (order.shippingAddress![key] ?? "")
      )
    )
      throw new Error(
        "Changes to country, state, or postal code require manual tax and shipping review."
      );
    const { streetName, streetNumber, city, state, postalCode, country, ...preserved } =
      order.shippingAddress;
    action = { action: "setShippingAddress", address: { ...preserved, ...address } };
  } else throw new Error("Unsupported order action.");
  const updated = await request(encodeURIComponent(args.id), {
    version: args.expectedVersion,
    actions: [action]
  });
  if (
    args.action.kind === "cancel_order"
      ? updated.orderState !== "Cancelled"
      : Object.entries(args.action.address!).some(
          ([key, value]) => updated.shippingAddress?.[key] !== value
        )
  )
    throw new Error("Order update outcome was not confirmed.");
  return {
    id: updated.id,
    version: updated.version,
    orderState: updated.orderState,
    shippingAddress: updated.shippingAddress
  };
}
