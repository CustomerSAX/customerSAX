import { ObjectId, type Document, type Filter, type Sort } from "mongodb";
import { getTicketsCollection } from "../db/mongodb.js";
import { mapTicket } from "./mapper.js";
import { generateTicketNumber } from "./ticket-number.js";
import type { Ticket, TicketDraft, TicketListArgs, TicketPage, TicketUpdate, WorklogComment } from "./types.js";

const memoryTickets: Document[] = [];

export async function listTickets(args: TicketListArgs): Promise<TicketPage> {
  if (usesMemoryStore()) {
    const { limit, offset } = paging(args);
    const filtered = memoryTickets.filter((ticket) => matchesArgs(ticket, args));
    const sorted = sortMemoryTickets(filtered, args);
    const results = sorted.slice(offset, offset + limit);

    return { count: results.length, offset, results: results.map(mapTicket), total: filtered.length };
  }

  const collection = await getTicketsCollection();
  const { limit, offset } = paging(args);
  const filter = buildFilter(args);
  const sort = buildSort(args);
  const [results, total] = await Promise.all([
    collection.find(filter).sort(sort).skip(offset).limit(limit).toArray(),
    collection.countDocuments(filter)
  ]);

  return {
    count: results.length,
    offset,
    results: results.map(mapTicket),
    total
  };
}

export async function getTicket(id: string, projectKey?: string | null): Promise<Ticket | null> {
  if (usesMemoryStore()) {
    const doc = memoryTickets.find((ticket) => matchesIdentity(ticket, id, resolveProjectKey(projectKey)));
    return doc ? mapTicket(doc) : null;
  }

  const collection = await getTicketsCollection();
  const filter = ticketIdentityFilter(id, resolveProjectKey(projectKey));
  const doc = await collection.findOne(filter);

  return doc ? mapTicket(doc) : null;
}

export async function createTicket(draft: TicketDraft): Promise<Ticket> {
  const now = new Date();
  const projectKey = resolveProjectKey(draft.projectKey);
  const ticketNumber = generateTicketNumber();
  const doc = {
    assignee: draft.assignee ?? "Queue",
    category: draft.category ?? null,
    createdAt: now,
    customerEmail: draft.customerEmail ?? null,
    customerName: draft.customerName ?? null,
    customerId: draft.customerId ?? null,
    contactType: draft.contactType ?? draft.source ?? "Email",
    orderNumber: draft.orderNumber ?? null,
    createdBy: draft.createdBy ?? "Current Agent",
    message: draft.message ?? "",
    solution: draft.solution ?? null,
    timeSpentOnTicket: draft.timeSpentOnTicket ?? null,
    comments: draft.comments ?? [],
    attachments: draft.attachments ?? [],
    history: [{ id: `hist-${now.getTime()}`, ticketNumber, operationDate: now.toISOString(), reason: draft.category ?? "general_inquiry", solution: draft.solution ?? null, status: draft.status ?? "Open", priority: draft.priority ?? "Medium", assignedTo: draft.assignee ?? "Queue", worklog: `Ticket created by ${draft.createdBy ?? "Current Agent"}`, timeSpent: null }],
    lastModifiedAt: now,
    priority: draft.priority ?? "normal",
    projectKey,
    source: draft.source ?? "Manual",
    status: draft.status ?? "Open",
    subject: draft.subject,
    ticketNumber
  };

  if (usesMemoryStore()) {
    const memoryDoc = { ...doc, _id: new ObjectId() };
    memoryTickets.push(memoryDoc);
    return mapTicket(memoryDoc);
  }

  const collection = await getTicketsCollection();

  const result = await collection.insertOne(doc);

  return mapTicket({ ...doc, _id: result.insertedId });
}

export async function addWorklog(id: string, comment: WorklogComment, projectKey?: string | null) {
  if (usesMemoryStore()) {
    const doc = memoryTickets.find((ticket) => matchesIdentity(ticket, id, resolveProjectKey(projectKey)));
    if (!doc) return null;
    doc.comments = [...(Array.isArray(doc.comments) ? doc.comments : []), comment];
    doc.lastModifiedAt = new Date();
    return mapTicket(doc);
  }

  const collection = await getTicketsCollection();
  const result = await collection.findOneAndUpdate(
    ticketIdentityFilter(id, resolveProjectKey(projectKey)),
    { $push: { comments: comment }, $set: { lastModifiedAt: new Date() } } as Document,
    { returnDocument: "after" }
  );
  return result ? mapTicket(result) : null;
}

export async function updateTicket(id: string, patch: TicketUpdate & { projectKey?: string | null }) {
  const projectKey = resolveProjectKey(patch.projectKey);
  const { projectKey: _projectKey, ...fields } = patch;
  const update = sanitizeUpdate(fields);

  if (Object.keys(update).length === 0) {
    return getTicket(id, projectKey);
  }

  if (usesMemoryStore()) {
    const doc = memoryTickets.find((ticket) => matchesIdentity(ticket, id, projectKey));
    if (!doc) return null;
    Object.assign(doc, update, { lastModifiedAt: new Date() });
    return mapTicket(doc);
  }

  const collection = await getTicketsCollection();

  const result = await collection.findOneAndUpdate(
    ticketIdentityFilter(id, projectKey),
    { $set: { ...update, lastModifiedAt: new Date() } },
    { returnDocument: "after" }
  );

  return result ? mapTicket(result) : null;
}

function buildFilter(args: TicketListArgs): Filter<Document> {
  const filter: Filter<Document> = { projectKey: resolveProjectKey(args.projectKey) };

  if (args.status?.trim()) {
    filter.status = args.status.trim();
  }
  if (args.priority?.trim()) {
    filter.priority = args.priority.trim();
  }
  if (args.category?.trim()) {
    filter.category = args.category.trim();
  }
  if (args.assignee?.trim()) {
    // Match both 'assignee' (current field) and the legacy 'assignedTo' field
    // that older documents in MongoDB were written with. Using $and ensures this
    // doesn't conflict with the search $or that may appear later in the filter.
    filter.$and = [
      ...((filter.$and as unknown[]) ?? []),
      { $or: [{ assignee: args.assignee.trim() }, { assignedTo: args.assignee.trim() }] }
    ] as Filter<Document>["$and"];
  }
  if (args.customerEmail?.trim()) {
    filter.customerEmail = new RegExp(escapeRegExp(args.customerEmail.trim()), "i");
  }
  if (args.search?.trim()) {
    const search = new RegExp(escapeRegExp(args.search.trim()), "i");
    filter.$or = [
      { ticketNumber: search },
      { subject: search },
      { customerEmail: search },
      { customerName: search },
      { category: search }
    ];
  }

  return filter;
}

function ticketIdentityFilter(id: string, projectKey: string): Filter<Document> {
  const identity: Document[] = [{ ticketNumber: id }];

  if (ObjectId.isValid(id) && id.length === 24) {
    identity.push({ _id: new ObjectId(id) });
  } else {
    identity.push({ _id: id });
  }

  return { $or: identity, projectKey };
}

function sanitizeUpdate(patch: TicketUpdate): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  const allowed = [
    "assignee",
    "category",
    "customerEmail",
    "customerName",
    "customerId",
    "contactType",
    "orderNumber",
    "message",
    "solution",
    "timeSpentOnTicket",
    "comments",
    "attachments",
    "priority",
    "source",
    "status",
    "subject"
  ] as const;

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      update[key] = patch[key];
    }
  }

  return update;
}

function paging(args: TicketListArgs) {
  return {
    limit: clamp(args.limit ?? 20, 1, 100),
    offset: Math.max(Math.floor(args.offset ?? 0), 0)
  };
}

function buildSort(args: TicketListArgs): Sort {
  const sortKey = args.sortKey?.trim() || "lastModifiedAt";
  const sortOrder = args.sortOrder === "asc" ? 1 : -1;

  return { [sortKey]: sortOrder };
}

function resolveProjectKey(projectKey?: string | null) {
  return projectKey?.trim() || process.env.TICKETING_PROJECT_KEY?.trim() || "default";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.floor(value), min), max);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function usesMemoryStore() {
  return !process.env.MONGO_URI?.trim();
}

function matchesIdentity(ticket: Document, id: string, projectKey: string) {
  const documentId = ticket._id instanceof ObjectId ? ticket._id.toHexString() : String(ticket._id ?? "");
  return ticket.projectKey === projectKey && (ticket.ticketNumber === id || documentId === id);
}

function matchesArgs(ticket: Document, args: TicketListArgs) {
  if (ticket.projectKey !== resolveProjectKey(args.projectKey)) return false;
  if (args.status?.trim() && ticket.status !== args.status.trim()) return false;
  if (args.priority?.trim() && ticket.priority !== args.priority.trim()) return false;
  if (args.category?.trim() && ticket.category !== args.category.trim()) return false;
  // Check both 'assignee' and legacy 'assignedTo' field (same as buildFilter above)
  if (args.assignee?.trim() && ticket.assignee !== args.assignee.trim() && ticket.assignedTo !== args.assignee.trim()) return false;
  if (args.customerEmail?.trim() && !contains(ticket.customerEmail, args.customerEmail)) return false;
  if (args.search?.trim()) {
    const fields = [ticket.ticketNumber, ticket.subject, ticket.customerEmail, ticket.customerName, ticket.category];
    if (!fields.some((value) => contains(value, args.search!))) return false;
  }
  return true;
}

function contains(value: unknown, search: string) {
  return String(value ?? "").toLowerCase().includes(search.trim().toLowerCase());
}

function sortMemoryTickets(tickets: Document[], args: TicketListArgs) {
  const key = args.sortKey?.trim() || "lastModifiedAt";
  const direction = args.sortOrder === "asc" ? 1 : -1;
  return [...tickets].sort((left, right) => {
    const a = left[key] instanceof Date ? left[key].getTime() : String(left[key] ?? "");
    const b = right[key] instanceof Date ? right[key].getTime() : String(right[key] ?? "");
    return a < b ? -direction : a > b ? direction : 0;
  });
}
