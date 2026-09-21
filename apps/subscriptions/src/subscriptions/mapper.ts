import { ObjectId, type Document } from "@csa/mongodb";
import type { Subscription, SubscriptionHistoryEntry, SubscriptionLineItem, SubscriptionStatus } from "./types.js";

export function mapSubscription(doc: Document): Subscription {
  const id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? doc.id ?? "");
  return {
    id,
    subscriptionNumber: String(doc.subscriptionNumber ?? id),
    projectKey: String(doc.projectKey ?? ""),
    ownerType: String(doc.ownerType ?? "B2C"),
    customerId: stringOrNull(doc.customerId),
    customerName: String(doc.customerName ?? ""),
    customerEmail: String(doc.customerEmail ?? ""),
    createdBy: String(doc.createdBy ?? firstHistoryActor(doc.history) ?? "Unknown agent"),
    businessAccountName: stringOrNull(doc.businessAccountName),
    status: normalizeStatus(doc.status),
    frequency: String(doc.frequency ?? "Monthly"),
    startDate: String(doc.startDate ?? ""),
    scheduleTime: stringOrNull(doc.scheduleTime),
    nextDeliveryDate: String(doc.nextDeliveryDate ?? ""),
    endDate: stringOrNull(doc.endDate),
    shippingAddress: String(doc.shippingAddress ?? ""),
    paymentMethod: String(doc.paymentMethod ?? ""),
    currencyCode: String(doc.currencyCode ?? "USD"),
    discountLabel: stringOrNull(doc.discountLabel),
    priceOverride: stringOrNull(doc.priceOverride),
    cancellationReason: stringOrNull(doc.cancellationReason),
    lastOrderNumber: stringOrNull(doc.lastOrderNumber),
    linkedOrderNumbers: stringArray(doc.linkedOrderNumbers),
    lineItems: lineItems(doc.lineItems),
    history: history(doc.history),
    createdAt: dateString(doc.createdAt),
    updatedAt: dateString(doc.updatedAt)
  };
}

function lineItems(value: unknown): SubscriptionLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => ({
    id: String(item?.id ?? `line-${index + 1}`),
    sku: String(item?.sku ?? ""),
    name: String(item?.name ?? item?.sku ?? ""),
    quantity: Number(item?.quantity ?? 1),
    unitPrice: Number(item?.unitPrice ?? 0)
  }));
}

function history(value: unknown): SubscriptionHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => ({
    id: String(entry?.id ?? `history-${index + 1}`),
    action: String(entry?.action ?? "Updated subscription"),
    actor: String(entry?.actor ?? "Unknown agent"),
    createdAt: dateString(entry?.createdAt),
    note: stringOrNull(entry?.note)
  }));
}

function normalizeStatus(value: unknown): SubscriptionStatus {
  const status = String(value ?? "Draft");
  return ["Draft", "Active", "Paused", "On Hold", "Cancelled", "Expired"].includes(status)
    ? (status as SubscriptionStatus)
    : "Draft";
}

function firstHistoryActor(value: unknown) {
  return Array.isArray(value) ? value[value.length - 1]?.actor : undefined;
}

function stringOrNull(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function dateString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value == null || value === "" ? new Date(0).toISOString() : String(value);
}
