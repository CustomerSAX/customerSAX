import { ObjectId, type Document, type Filter, type Sort } from "mongodb";
import { getTicketsCollection } from "../db/mongodb.js";
import { mapTicket } from "./mapper.js";
import { generateTicketNumber } from "./ticket-number.js";
import type { Ticket, TicketDraft, TicketListArgs, TicketPage, TicketUpdate } from "./types.js";

export async function listTickets(args: TicketListArgs): Promise<TicketPage> {
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
  const collection = await getTicketsCollection();
  const filter = ticketIdentityFilter(id, resolveProjectKey(projectKey));
  const doc = await collection.findOne(filter);

  return doc ? mapTicket(doc) : null;
}

export async function createTicket(draft: TicketDraft): Promise<Ticket> {
  const collection = await getTicketsCollection();
  const now = new Date();
  const projectKey = resolveProjectKey(draft.projectKey);
  const doc = {
    assignee: draft.assignee ?? "Queue",
    category: draft.category ?? null,
    createdAt: now,
    customerEmail: draft.customerEmail ?? null,
    customerName: draft.customerName ?? null,
    lastModifiedAt: now,
    priority: draft.priority ?? "normal",
    projectKey,
    source: draft.source ?? "Manual",
    status: draft.status ?? "open",
    subject: draft.subject,
    ticketNumber: generateTicketNumber()
  };

  const result = await collection.insertOne(doc);

  return mapTicket({ ...doc, _id: result.insertedId });
}

export async function updateTicket(id: string, patch: TicketUpdate & { projectKey?: string | null }) {
  const collection = await getTicketsCollection();
  const projectKey = resolveProjectKey(patch.projectKey);
  const { projectKey: _projectKey, ...fields } = patch;
  const update = sanitizeUpdate(fields);

  if (Object.keys(update).length === 0) {
    return getTicket(id, projectKey);
  }

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
    filter.assignee = args.assignee.trim();
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
