import { ObjectId, type Document, type Filter, type Sort } from "@csa/mongodb";
import { createLogger } from "@csa/logger";
import { getTicketsCollection } from "../db/mongodb.js";
import { mapTicket } from "./mapper.js";
import { generateTicketNumber, nextTicketNumber } from "./ticket-number.js";
import type { InformationRequest, Ticket, TicketDraft, TicketListArgs, TicketPage, TicketUpdate, WorklogComment } from "./types.js";
import { NO_SLA_DUE, nativeSla, slaSortAt, statusEvents, type SlaEvent, type SlaTarget } from "./native-sla.js";
import { SLA_SORT_KEY, sortBySlaDue } from "./sla.js";

const log = createLogger("ticketing").child({ module: "tickets/repository" });

const memoryTickets: Document[] = [];

export type NativeTicketScope = { clientId: string; includeLegacy: boolean };
function ownerFilter(scope?: NativeTicketScope): Filter<Document> {
  if (!scope) return { clientId: { $exists: false } };
  return scope.includeLegacy
    ? { $or: [{ clientId: scope.clientId }, { clientId: { $exists: false } }] }
    : { clientId: scope.clientId };
}
function matchesOwner(ticket: Document, scope?: NativeTicketScope) {
  return scope ? ticket.clientId === scope.clientId || (scope.includeLegacy && ticket.clientId === undefined) : ticket.clientId === undefined;
}

/**
 * Startup guard for the ticket data store. Call this ONCE at process boot,
 * before serving traffic.
 *
 * When `MONGO_URI` is unset the repository falls back to an in-process array
 * (`memoryTickets`) that is lost on every restart. That is acceptable for local
 * development but catastrophic in production: a misconfigured prod deployment
 * would appear to accept tickets and then silently lose every one of them on
 * the next restart. So:
 *   - in production (`NODE_ENV==='production'`) with no `MONGO_URI`, HARD-FAIL —
 *     throw and refuse to serve rather than run the ephemeral memory store;
 *   - in any non-production environment, allow the memory store but emit a LOUD
 *     startup warning so it is never selected silently.
 */
export function assertTicketStoreConfigured() {
  if (!usesMemoryStore()) return;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Ticketing refuses to start: MONGO_URI is not set in production. The in-memory ticket store is ephemeral and would lose every ticket on restart. Set MONGO_URI to a real MongoDB connection string."
    );
  }

  log.warn(
    "USING IN-MEMORY TICKET STORE — MONGO_URI is not set. Tickets are held in-process and WILL BE LOST on restart. This is for local/dev only; set MONGO_URI for any durable environment."
  );
}

export async function listTickets(args: TicketListArgs, scope?: NativeTicketScope): Promise<TicketPage> {
  if (usesMemoryStore()) {
    const { limit, offset } = paging(args);
    const filtered = memoryTickets.filter((ticket) => matchesArgs(ticket, args) && matchesOwner(ticket, scope));
    const sorted = args.sortKey === SLA_SORT_KEY
      ? sortBySlaDue(sortMemoryTickets(filtered, {}).map(mapTicket))
      : sortMemoryTickets(filtered, args).map(mapTicket);
    const results = sorted.slice(offset, offset + limit);

    return { count: results.length, offset, results, total: filtered.length };
  }

  const collection = await getTicketsCollection();
  const { limit, offset } = paging(args);
  const filter = { $and: [buildFilter(args), ownerFilter(scope)] };
  // Tickets predating SLA tracking have no slaSortAt; rank them with the "nothing running" ones, last.
  const page = args.sortKey === SLA_SORT_KEY
    ? collection.aggregate([
        { $match: filter },
        { $addFields: { _slaSortAt: { $ifNull: ["$slaSortAt", NO_SLA_DUE] } } },
        { $sort: { _slaSortAt: 1, lastModifiedAt: -1 } },
        { $skip: offset },
        { $limit: limit }
      ]).toArray()
    : collection.find(filter).sort(buildSort(args)).skip(offset).limit(limit).toArray();
  const [results, total] = await Promise.all([page, collection.countDocuments(filter)]);

  return {
    count: results.length,
    offset,
    results: results.map(mapTicket),
    total
  };
}

export async function getTicket(id: string, projectKey?: string | null, scope?: NativeTicketScope): Promise<Ticket | null> {
  if (usesMemoryStore()) {
    const doc = memoryTickets.find((ticket) => matchesIdentity(ticket, id, resolveProjectKey(projectKey)) && matchesOwner(ticket, scope));
    return doc ? mapTicket(doc) : null;
  }

  const collection = await getTicketsCollection();
  const filter = ticketIdentityFilter(id, resolveProjectKey(projectKey), scope);
  const doc = await collection.findOne(filter);

  return doc ? mapTicket(doc) : null;
}

/**
 * @param slaTargets The project's SLA targets at creation time, copied onto the
 * ticket so later policy edits never change an existing ticket's clocks.
 */
export async function createTicket(draft: TicketDraft, scope?: NativeTicketScope, slaTargets?: Partial<Record<string, SlaTarget>>): Promise<Ticket> {
  const now = new Date();
  const projectKey = resolveProjectKey(draft.projectKey);
  // Durable atomic counter for the real Mongo store; random-suffix fallback for
  // the in-memory dev store (which has no counter to draw from).
  const ticketNumber = usesMemoryStore() ? generateTicketNumber() : await nextTicketNumber(projectKey);
  const doc = {
    ...(scope ? { clientId: scope.clientId } : {}),
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
    history: [{ id: `hist-${now.getTime()}`, ticketNumber, operationDate: now.toISOString(), reason: draft.category ?? "general_inquiry", solution: draft.solution ?? null, status: draft.status ?? "Open", priority: draft.priority ?? "Medium", assignedTo: draft.assignee ?? "Queue", worklog: draft.worklog ? `Ticket created by ${draft.createdBy ?? "Current Agent"}. ${draft.worklog}` : `Ticket created by ${draft.createdBy ?? "Current Agent"}`, timeSpent: null }],
    lastModifiedAt: now,
    priority: draft.priority ?? "normal",
    projectKey,
    source: draft.source ?? "Manual",
    status: draft.status ?? "Open",
    subject: draft.subject,
    ticketNumber,
    ...slaFields(slaTargets, draft.status ?? "Open", draft.priority ?? "normal", now)
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

export async function addWorklog(id: string, comment: WorklogComment, projectKey?: string | null, scope?: NativeTicketScope) {
  if (usesMemoryStore()) {
    const doc = memoryTickets.find((ticket) => matchesIdentity(ticket, id, resolveProjectKey(projectKey)) && matchesOwner(ticket, scope));
    if (!doc) return null;
    doc.comments = [...(Array.isArray(doc.comments) ? doc.comments : []), comment];
    doc.lastModifiedAt = new Date();
    return recordSla(doc, [{ type: "action", at: doc.lastModifiedAt }]);
  }

  const collection = await getTicketsCollection();
  const result = await collection.findOneAndUpdate(
    ticketIdentityFilter(id, resolveProjectKey(projectKey), scope),
    { $push: { comments: comment }, $set: { lastModifiedAt: new Date() } } as Document,
    { returnDocument: "after" }
  );
  return result ? recordSla(result, [{ type: "action", at: result.lastModifiedAt }]) : null;
}

export async function updateTicket(id: string, patch: TicketUpdate & { projectKey?: string | null }, scope?: NativeTicketScope) {
  const projectKey = resolveProjectKey(patch.projectKey);
  const { projectKey: _projectKey, ...fields } = patch;
  const update = sanitizeUpdate(fields);

  if (Object.keys(update).length === 0) {
    return getTicket(id, projectKey, scope);
  }

  if (usesMemoryStore()) {
    const doc = memoryTickets.find((ticket) => matchesIdentity(ticket, id, projectKey) && matchesOwner(ticket, scope));
    if (!doc) return null;
    Object.assign(doc, update, { lastModifiedAt: new Date() });
    return recordSla(doc, updateEvents(update, doc.lastModifiedAt));
  }

  const collection = await getTicketsCollection();

  const result = await collection.findOneAndUpdate(
    ticketIdentityFilter(id, projectKey, scope),
    { $set: { ...update, lastModifiedAt: new Date() } },
    { returnDocument: "after" }
  );

  return result ? recordSla(result, updateEvents(update, result.lastModifiedAt)) : null;
}

/** Save the approved resolution and close atomically, only if the ticket is unchanged. */
export async function closeIfUnchanged(id: string, expectedLastModifiedAt: string, projectKey: string, scope: NativeTicketScope | undefined, solution: string) {
  if (typeof solution !== "string" || !solution.trim() || solution.trim().length > 5000) throw new Error("Resolution notes are required and must be at most 5,000 characters");
  const expected = new Date(expectedLastModifiedAt);
  if (!Number.isFinite(expected.getTime())) throw new Error("A valid ticket revision is required");
  const modifiedAt = new Date();
  if (usesMemoryStore()) {
    const doc = memoryTickets.find((ticket) => matchesIdentity(ticket, id, projectKey) && matchesOwner(ticket, scope));
    if (!doc || new Date(doc.lastModifiedAt).getTime() !== expected.getTime()) return null;
    Object.assign(doc, { status: "Closed", solution: solution.trim(), lastModifiedAt: modifiedAt });
    return recordSla(doc, statusEvents("Closed", modifiedAt));
  }
  const collection = await getTicketsCollection();
  const result = await collection.findOneAndUpdate(
    { $and: [ticketIdentityFilter(id, projectKey, scope), { lastModifiedAt: expected }] },
    { $set: { status: "Closed", solution: solution.trim(), lastModifiedAt: modifiedAt } },
    { returnDocument: "after" }
  );
  return result ? recordSla(result, statusEvents("Closed", modifiedAt)) : null;
}

/**
 * Client-owned native tickets whose soonest running SLA deadline is at or
 * before `cutoff` (breached or about to be), soonest first, across all
 * clients. Used by the SLA alert sweep; returns each ticket with its owner.
 */
export async function ticketsWithSlaDueBy(cutoff: Date, limit: number): Promise<Array<{ clientId: string; ticket: Ticket }>> {
  const due = (doc: Document) => typeof doc.clientId === "string" && doc.slaPolicy && doc.slaSortAt && new Date(doc.slaSortAt).getTime() <= cutoff.getTime();
  const docs = usesMemoryStore()
    ? memoryTickets.filter(due).sort((a, b) => new Date(a.slaSortAt).getTime() - new Date(b.slaSortAt).getTime()).slice(0, limit)
    : await (await getTicketsCollection())
        .find({ clientId: { $type: "string" }, slaPolicy: { $exists: true }, slaSortAt: { $lte: cutoff } })
        .sort({ slaSortAt: 1 })
        .limit(limit)
        .toArray();
  return docs.map((doc) => ({ clientId: doc.clientId as string, ticket: mapTicket(doc) }));
}

function slaFields(targets: Partial<Record<string, SlaTarget>> | undefined, status: string, priority: string, now: Date) {
  if (!targets || !Object.keys(targets).length) return {};
  const slaPolicy = { startedAt: now, targets };
  // Creating a ticket isn't a response, so only its starting status is recorded.
  const slaEvents: SlaEvent[] = statusEvents(status, now).filter((event) => event.type === "status");
  return { slaPolicy, slaEvents, slaSortAt: slaSortAt(nativeSla(slaPolicy, slaEvents, priority)) };
}

/** A status change, or assigning the ticket to a person, is an agent acting on it. */
function updateEvents(update: Record<string, unknown>, at: Date): SlaEvent[] {
  const events: SlaEvent[] = typeof update.status === "string" ? statusEvents(update.status, at) : [];
  if (typeof update.assignee === "string" && update.assignee.trim() && update.assignee !== "Queue") events.push({ type: "action", at });
  return events;
}

/**
 * Appends SLA events to a ticket that has an SLA policy and refreshes its
 * stored next deadline (used for "breaching soon" sorting), then returns the
 * mapped ticket. Tickets without a policy are returned unchanged. A priority
 * change moves the deadline too, so this also runs with no new events.
 */
async function recordSla(doc: Document, events: SlaEvent[]): Promise<Ticket> {
  if (!doc.slaPolicy) return mapTicket(doc);
  if (usesMemoryStore()) {
    doc.slaEvents = [...(Array.isArray(doc.slaEvents) ? doc.slaEvents : []), ...events];
    doc.slaSortAt = slaSortAt(nativeSla(doc.slaPolicy, doc.slaEvents, doc.priority));
    return mapTicket(doc);
  }
  const collection = await getTicketsCollection();
  const updated = events.length
    ? await collection.findOneAndUpdate({ _id: doc._id }, { $push: { slaEvents: { $each: events } } } as Document, { returnDocument: "after" })
    : doc;
  if (!updated) return mapTicket(doc);
  const sortAt = slaSortAt(nativeSla(updated.slaPolicy, updated.slaEvents, updated.priority));
  await collection.updateOne({ _id: updated._id }, { $set: { slaSortAt: sortAt } });
  return mapTicket({ ...updated, slaSortAt: sortAt });
}

function buildFilter(args: TicketListArgs): Filter<Document> {
  const filter: Filter<Document> = { projectKey: resolveProjectKey(args.projectKey) };

  if (args.status?.trim()) {
    filter.status = { $in: equivalentValues(args.status, STATUS_SYNONYMS) };
  }
  if (args.priority?.trim()) {
    filter.priority = { $in: equivalentValues(args.priority, PRIORITY_SYNONYMS) };
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
  if (args.customerId?.trim()) {
    filter.customerId = args.customerId.trim();
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

function ticketIdentityFilter(id: string, projectKey: string, scope?: NativeTicketScope): Filter<Document> {
  const identity: Document[] = [{ ticketNumber: id }];

  if (ObjectId.isValid(id) && id.length === 24) {
    identity.push({ _id: new ObjectId(id) });
  } else {
    identity.push({ _id: id });
  }

  return { $or: identity, projectKey, $and: [ownerFilter(scope)] };
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

// Stored values mix casing and vocabulary across writers (studio "In Progress"/
// "Medium", AI tools "in progress"/"normal"), so filters match any spelling of
// the same value. Keys are normalized: lower-case, "_"/"-" read as spaces.
const STATUS_SYNONYMS: Record<string, string[]> = { pending: ["pending", "waiting"], waiting: ["pending", "waiting"] };
const PRIORITY_SYNONYMS: Record<string, string[]> = { normal: ["normal", "medium"], medium: ["normal", "medium"] };

/** Exact, case-insensitive matchers for a filter value and its synonyms ("in_progress" matches "In Progress"). */
function equivalentValues(value: string, synonyms: Record<string, string[]>): RegExp[] {
  const key = value.trim().toLowerCase().replace(/[_-]/g, " ");
  return (synonyms[key] ?? [key]).map((word) => new RegExp(`^${escapeRegExp(word).replace(/ /g, "[ _-]")}$`, "i"));
}

function matchesArgs(ticket: Document, args: TicketListArgs) {
  if (ticket.projectKey !== resolveProjectKey(args.projectKey)) return false;
  if (args.status?.trim() && !equivalentValues(args.status, STATUS_SYNONYMS).some((re) => re.test(String(ticket.status ?? "")))) return false;
  if (args.priority?.trim() && !equivalentValues(args.priority, PRIORITY_SYNONYMS).some((re) => re.test(String(ticket.priority ?? "")))) return false;
  if (args.category?.trim() && ticket.category !== args.category.trim()) return false;
  // Check both 'assignee' and legacy 'assignedTo' field (same as buildFilter above)
  if (args.assignee?.trim() && ticket.assignee !== args.assignee.trim() && ticket.assignedTo !== args.assignee.trim()) return false;
  if (args.customerEmail?.trim() && !contains(ticket.customerEmail, args.customerEmail)) return false;
  if (args.customerId?.trim() && ticket.customerId !== args.customerId.trim()) return false;
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

/** Claim once per ticket before contacting the provider; survives restarts with MongoDB. */
export async function claimInformationRequest(ticket: Ticket, request: InformationRequest, scope?: NativeTicketScope): Promise<boolean> {
  if (!ticket.lastModifiedAt) return false;
  if (usesMemoryStore()) {
    const doc = memoryTickets.find(item => matchesIdentity(item, ticket.id, ticket.projectKey) && matchesOwner(item, scope));
    if (!doc || doc.informationRequest || mapTicket(doc).lastModifiedAt !== ticket.lastModifiedAt) return false;
    doc.informationRequest = request;
    return true;
  }
  const result = await (await getTicketsCollection()).updateOne(
    { $and: [ticketIdentityFilter(ticket.id, ticket.projectKey, scope), {
      informationRequest: { $exists: false }, lastModifiedAt: new Date(ticket.lastModifiedAt)
    }] },
    { $set: { informationRequest: request } }
  );
  return result.modifiedCount === 1;
}

export async function finishInformationRequest(ticket: Ticket, request: InformationRequest, scope?: NativeTicketScope): Promise<void> {
  // Persist the outcome even if an agent edited the ticket while sending.
  // Change workflow status only if the original ticket revision is still current.
  const comment = { id: `email-${request.createdAt}`, author: "CustomerSAX email", createdAt: new Date().toISOString(),
    status: "Completed", comment: `Customer information request: ${request.status}\nTo: ${request.recipient}\nSubject: ${request.subject}\n\n${request.text}` };
  if (usesMemoryStore()) {
    const doc = memoryTickets.find(item => matchesIdentity(item, ticket.id, ticket.projectKey) && matchesOwner(item, scope));
    if (!doc || doc.informationRequest?.status !== "sending") return;
    const pending = request.status === "accepted" && doc.status === ticket.status && mapTicket(doc).lastModifiedAt === ticket.lastModifiedAt;
    if (pending) doc.status = "Pending";
    doc.informationRequest = request;
    doc.comments = [...(doc.comments ?? []), comment];
    doc.lastModifiedAt = new Date();
    if (request.status === "accepted") await recordSla(doc, informationRequestEvents(pending, doc.lastModifiedAt));
    return;
  }
  const collection = await getTicketsCollection();
  const identity = ticketIdentityFilter(ticket.id, ticket.projectKey, scope);
  const pending = request.status === "accepted" && (await collection.updateOne(
    { $and: [identity, { lastModifiedAt: new Date(ticket.lastModifiedAt!), status: ticket.status, "informationRequest.status": "sending" }] },
    { $set: { status: "Pending" } }
  )).modifiedCount === 1;
  const finished = await collection.findOneAndUpdate(
    { $and: [identity, { "informationRequest.status": "sending" }] },
    { $set: { informationRequest: request, lastModifiedAt: new Date() }, $push: { comments: comment } } as Document,
    { returnDocument: "after" }
  );
  if (finished && request.status === "accepted") await recordSla(finished, informationRequestEvents(pending, finished.lastModifiedAt));
}

/** An email actually sent to the customer is a response; the automatic move to Pending pauses the clock. */
function informationRequestEvents(pending: boolean, at: Date): SlaEvent[] {
  return pending ? statusEvents("Pending", at) : [{ type: "action", at }];
}
