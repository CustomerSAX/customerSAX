import { ObjectId, type Document } from "mongodb";
import type { Ticket } from "./types.js";

export function mapTicket(doc: Document): Ticket {
  const id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? doc.id ?? "");

  return {
    assignee: stringOrNull(doc.assignee),
    category: stringOrNull(doc.category),
    createdAt: dateString(doc.createdAt),
    customerEmail: stringOrNull(doc.customerEmail ?? doc.email),
    customerName: stringOrNull(doc.customerName ?? doc.customer),
    id,
    lastModifiedAt: dateString(doc.lastModifiedAt),
    priority: String(doc.priority ?? "normal"),
    projectKey: String(doc.projectKey ?? ""),
    source: stringOrNull(doc.source),
    status: String(doc.status ?? "open"),
    subject: String(doc.subject ?? ""),
    ticketNumber: String(doc.ticketNumber ?? id)
  };
}

function stringOrNull(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

function dateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value == null || value === "" ? null : String(value);
}
