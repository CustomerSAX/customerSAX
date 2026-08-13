import { ObjectId, type Document } from "@csa/mongodb";
import type { Ticket } from "./types.js";

export function mapTicket(doc: Document): Ticket {
  const id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? doc.id ?? "");
  const ticketNumber = String(doc.ticketNumber ?? id);

  return {
    assignee: stringOrNull(doc.assignee),
    category: stringOrNull(doc.category),
    createdAt: dateString(doc.createdAt),
    customerEmail: stringOrNull(doc.customerEmail ?? doc.email),
    customerName: stringOrNull(doc.customerName ?? doc.customer),
    customerId: stringOrNull(doc.customerId),
    contactType: stringOrNull(doc.contactType ?? doc.source),
    orderNumber: stringOrNull(doc.orderNumber),
    createdBy: stringOrNull(doc.createdBy),
    message: stringOrNull(doc.message ?? doc.ticketData?.message),
    solution: stringOrNull(doc.solution ?? doc.resolution),
    timeSpentOnTicket: stringOrNull(doc.timeSpentOnTicket),
    resolutionDate: dateString(doc.resolutionDate),
    comments: normalizeComments(doc.comments ?? doc.ticketData?.comments),
    attachments: normalizeAttachments(doc.attachments ?? doc.ticketData?.files),
    history: normalizeHistory(doc.history, ticketNumber),
    id,
    lastModifiedAt: dateString(doc.lastModifiedAt),
    priority: String(doc.priority ?? "normal"),
    projectKey: String(doc.projectKey ?? ""),
    source: stringOrNull(doc.source),
    status: String(doc.status ?? "open"),
    subject: String(doc.subject ?? ""),
    ticketNumber
  };
}

function normalizeComments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map((entry, index) => ({
    id: String(entry?.id ?? entry?._id ?? `comment-${index}`),
    comment: String(entry?.comment ?? entry?.worklog ?? ""),
    createdAt: dateString(entry?.createdAt ?? entry?.operationDate) ?? new Date(0).toISOString(),
    status: String(entry?.status ?? "Completed"),
    author: stringOrNull(entry?.author ?? entry?.createdBy)
  }));
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry) => entry && (entry.name || entry.fileName) && (entry.url || entry.fileUrl))
    .map((entry) => ({
      name: String(entry.name ?? entry.fileName),
      url: String(entry.url ?? entry.fileUrl),
      size: stringOrNull(entry.size)
    }));
}

function normalizeHistory(value: unknown, ticketNumber: string) {
  if (!Array.isArray(value)) return [];

  return value.map((entry, index) => ({
    id: String(entry?.id ?? entry?._id ?? `history-${index}`),
    ticketNumber: String(entry?.ticketNumber ?? ticketNumber),
    operationDate: dateString(entry?.operationDate ?? entry?.createdAt) ?? new Date(0).toISOString(),
    reason: String(entry?.reason ?? entry?.category ?? "general_inquiry"),
    solution: stringOrNull(entry?.solution),
    status: String(entry?.status ?? "Open"),
    priority: String(entry?.priority ?? "Medium"),
    assignedTo: String(entry?.assignedTo ?? entry?.assignee ?? "Queue"),
    worklog: stringOrNull(entry?.worklog ?? entry?.comment),
    timeSpent: stringOrNull(entry?.timeSpent)
  }));
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
