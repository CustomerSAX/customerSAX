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
  createdAt?: string;
  shippingAddress?: Record<string, unknown>;
  lineItems?: Array<{
    id: string;
    quantity: number;
    name?: string | Record<string, string>;
    sku?: string;
    variant?: { sku?: string };
    totalPrice?: unknown;
  }>;
  returnInfo?: Array<{
    returnTrackingId?: string;
    items?: Array<{ lineItemId?: string; quantity: number }>;
  }>;
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
    createdAt,
    lastModifiedAt,
    totalPrice,
    lineItems: rawLineItems,
    returnInfo
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
    createdAt,
    lastModifiedAt,
    totalPrice,
    lineItems: (rawLineItems ?? []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
      name:
        typeof item.name === "string"
          ? item.name
          : Object.values(item.name ?? {})[0] ?? "",
      sku: item.sku ?? item.variant?.sku,
      totalPrice: item.totalPrice
    })),
    returnInfo
  };
}
export async function updateReviewedOrder(args: {
  id: string;
  customerId: string;
  expectedVersion: number;
  action: {
    kind: string;
    address?: Record<string, string>;
    reason?: string;
    lineItems?: Array<{ lineItemId: string; quantity: number }>;
  };
}) {
  const order = await request(encodeURIComponent(args.id));
  if (order.customerId !== args.customerId || order.version !== args.expectedVersion)
    throw new Error("The customer or order version changed. Prepare a new proposal.");
  let action: Record<string, unknown>;
  let returnTrackingId: string | undefined;
  if (args.action.kind === "start_return") {
    const windowDays = Number.parseInt(process.env.RETURN_WINDOW_DAYS ?? "30", 10);
    const createdAt = Date.parse(order.createdAt ?? "");
    if (
      ["Cancelled", "ReturnReceived"].includes(order.orderState ?? "") ||
      !["Shipped", "Partial", "Delivered"].includes(order.shipmentState ?? "") ||
      order.paymentState !== "Paid" ||
      !Number.isFinite(createdAt) ||
      !Number.isFinite(windowDays) ||
      Date.now() - createdAt > windowDays * 86_400_000
    )
      throw new Error("The order is not currently eligible for return.");
    const reason = args.action.reason?.trim();
    const requested = args.action.lineItems;
    if (!reason || reason.length > 500 || !requested?.length)
      throw new Error("A return reason and at least one line item are required.");
    const returned = new Map<string, number>();
    for (const info of order.returnInfo ?? [])
      for (const item of info.items ?? [])
        if (item.lineItemId)
          returned.set(item.lineItemId, (returned.get(item.lineItemId) ?? 0) + item.quantity);
    const ordered = new Map((order.lineItems ?? []).map((item) => [item.id, item.quantity]));
    const selectedIds = new Set<string>();
    for (const item of requested) {
      const remaining = (ordered.get(item.lineItemId) ?? 0) - (returned.get(item.lineItemId) ?? 0);
      if (
        selectedIds.has(item.lineItemId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > remaining
      )
        throw new Error("The approved return quantity is no longer available.");
      selectedIds.add(item.lineItemId);
    }
    returnTrackingId = `CSA-RETURN-${Date.now()}`;
    action = {
      action: "addReturnInfo",
      items: requested.map((item) => ({
        lineItemId: item.lineItemId,
        quantity: item.quantity,
        shipmentState: "Returned",
        comment: reason
      })),
      returnDate: new Date().toISOString(),
      returnTrackingId
    };
  } else {
    if (
      !["Open", "Confirmed"].includes(order.orderState ?? "") ||
      !["Pending", "Ready"].includes(order.shipmentState ?? "")
    )
      throw new Error(
        "Only open or confirmed orders awaiting shipment support this action."
      );
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
  }
  const updated = await request(encodeURIComponent(args.id), {
    version: args.expectedVersion,
    actions: [action]
  });
  if (
    args.action.kind === "cancel_order"
      ? updated.orderState !== "Cancelled"
      : args.action.kind === "start_return"
        ? !updated.returnInfo?.some((info) => info.returnTrackingId === returnTrackingId)
        : Object.entries(args.action.address!).some(
          ([key, value]) => updated.shippingAddress?.[key] !== value
        )
  )
    throw new Error("Order update outcome was not confirmed.");
  return {
    id: updated.id,
    version: updated.version,
    orderState: updated.orderState,
    shippingAddress: updated.shippingAddress,
    ...(returnTrackingId ? { returnTrackingId } : {})
  };
}
