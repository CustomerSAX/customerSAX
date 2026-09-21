import { ObjectId, env, getMongoCollection, type Document, type Filter } from "@csa/mongodb";
import { createLogger } from "@csa/logger";
import { getSubscriptionsCollection } from "../db/mongodb.js";
import { mapSubscription } from "./mapper.js";
import type { Subscription, SubscriptionDraft, SubscriptionListArgs, SubscriptionStatus, SubscriptionUpdate } from "./types.js";

const log = createLogger("subscriptions").child({ module: "subscriptions/repository" });
const memorySubscriptions: Document[] = [];
const statuses = new Set<SubscriptionStatus>(["Draft", "Active", "Paused", "On Hold", "Cancelled", "Expired"]);

export function assertSubscriptionStoreConfigured() {
  if (!usesMemoryStore()) return;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Subscriptions refuses to start: MONGO_URI is not set in production.");
  }
  log.warn("USING IN-MEMORY SUBSCRIPTION STORE — MONGO_URI is not set. Records will be lost on restart.");
}

export async function listSubscriptions(args: SubscriptionListArgs): Promise<Subscription[]> {
  const projectKey = resolveProjectKey(args.projectKey);
  if (usesMemoryStore()) return memorySubscriptions.filter((doc) => matches(doc, { ...args, projectKey })).map(mapSubscription);
  const collection = await getSubscriptionsCollection();
  const limit = clamp(args.limit ?? 100, 1, 250);
  const offset = Math.max(args.offset ?? 0, 0);
  const docs = await collection.find(buildFilter({ ...args, projectKey })).sort({ updatedAt: -1 }).skip(offset).limit(limit).toArray();
  return docs.map(mapSubscription);
}

export async function getSubscription(id: string, projectKey?: string | null): Promise<Subscription | null> {
  const scopedProjectKey = resolveProjectKey(projectKey);
  if (usesMemoryStore()) {
    const doc = memorySubscriptions.find((candidate) => matchesIdentity(candidate, id, scopedProjectKey));
    return doc ? mapSubscription(doc) : null;
  }
  const collection = await getSubscriptionsCollection();
  const doc = await collection.findOne(identityFilter(id, scopedProjectKey));
  return doc ? mapSubscription(doc) : null;
}

export async function createSubscription(draft: SubscriptionDraft, projectKey: string, actor: string): Promise<Subscription> {
  validateDraft(draft);
  const now = new Date();
  const subscriptionNumber = usesMemoryStore() ? memorySubscriptionNumber() : await nextSubscriptionNumber(projectKey);
  const doc: Document = {
    ...cleanDraft(draft),
    createdBy: actor,
    projectKey,
    subscriptionNumber,
    linkedOrderNumbers: draft.linkedOrderNumbers ?? [],
    history: [history("Created subscription", actor)],
    createdAt: now,
    updatedAt: now
  };
  if (usesMemoryStore()) {
    const stored = { ...doc, _id: new ObjectId() };
    memorySubscriptions.unshift(stored);
    return mapSubscription(stored);
  }
  const collection = await getSubscriptionsCollection();
  const result = await collection.insertOne(doc);
  return mapSubscription({ ...doc, _id: result.insertedId });
}

export async function updateSubscription(id: string, patch: SubscriptionUpdate, projectKey: string, actor: string): Promise<Subscription | null> {
  if (patch.status && !statuses.has(patch.status)) throw new Error("Invalid subscription status");
  if (patch.lineItems) validateLineItems(patch.lineItems);
  const update = cleanDraft(patch);
  const event = history("Updated subscription", actor);
  if (usesMemoryStore()) {
    const doc = memorySubscriptions.find((candidate) => matchesIdentity(candidate, id, projectKey));
    if (!doc) return null;
    Object.assign(doc, update, { updatedAt: new Date(), history: [event, ...(Array.isArray(doc.history) ? doc.history : [])] });
    return mapSubscription(doc);
  }
  const collection = await getSubscriptionsCollection();
  const doc = await collection.findOneAndUpdate(
    identityFilter(id, projectKey),
    { $set: { ...update, updatedAt: new Date() }, $push: { history: { $each: [event], $position: 0 } } } as Document,
    { returnDocument: "after" }
  );
  return doc ? mapSubscription(doc) : null;
}

export async function changeSubscriptionStatus(id: string, status: SubscriptionStatus, note: string | null | undefined, projectKey: string, actor: string): Promise<Subscription | null> {
  if (!statuses.has(status)) throw new Error("Invalid subscription status");
  const update: Document = { status, updatedAt: new Date() };
  if (status === "Cancelled") update.cancellationReason = note?.trim() || "No reason provided";
  const event = history(`${status} subscription`, actor, note);
  if (usesMemoryStore()) {
    const doc = memorySubscriptions.find((candidate) => matchesIdentity(candidate, id, projectKey));
    if (!doc) return null;
    Object.assign(doc, update, { history: [event, ...(Array.isArray(doc.history) ? doc.history : [])] });
    return mapSubscription(doc);
  }
  const collection = await getSubscriptionsCollection();
  const doc = await collection.findOneAndUpdate(identityFilter(id, projectKey), { $set: update, $push: { history: { $each: [event], $position: 0 } } } as Document, { returnDocument: "after" });
  return doc ? mapSubscription(doc) : null;
}

export async function skipSubscriptionCycle(id: string, projectKey: string, actor: string): Promise<Subscription | null> {
  const existing = await getSubscription(id, projectKey);
  if (!existing) return null;
  if (existing.status !== "Active") throw new Error("Only active subscriptions can skip a delivery");
  const nextDeliveryDate = advanceCycle(existing.nextDeliveryDate, existing.frequency);
  const event = history("Skipped upcoming cycle", actor, `Moved next delivery from ${existing.nextDeliveryDate}`);
  if (usesMemoryStore()) {
    const doc = memorySubscriptions.find((candidate) => matchesIdentity(candidate, id, projectKey));
    if (!doc) return null;
    Object.assign(doc, { nextDeliveryDate, updatedAt: new Date(), history: [event, ...(Array.isArray(doc.history) ? doc.history : [])] });
    return mapSubscription(doc);
  }
  const collection = await getSubscriptionsCollection();
  const doc = await collection.findOneAndUpdate(identityFilter(id, projectKey), { $set: { nextDeliveryDate, updatedAt: new Date() }, $push: { history: { $each: [event], $position: 0 } } } as Document, { returnDocument: "after" });
  return doc ? mapSubscription(doc) : null;
}

export async function deleteSubscriptionDraft(id: string, projectKey: string): Promise<boolean> {
  if (usesMemoryStore()) {
    const index = memorySubscriptions.findIndex((candidate) => matchesIdentity(candidate, id, projectKey) && candidate.status === "Draft");
    if (index < 0) return false;
    memorySubscriptions.splice(index, 1);
    return true;
  }
  const collection = await getSubscriptionsCollection();
  const result = await collection.deleteOne({ ...identityFilter(id, projectKey), status: "Draft" } as Filter<Document>);
  return result.deletedCount === 1;
}

function buildFilter(args: SubscriptionListArgs): Filter<Document> {
  const filter: Filter<Document> = { projectKey: resolveProjectKey(args.projectKey) };
  if (args.customerId?.trim()) filter.customerId = args.customerId.trim();
  if (args.customerEmail?.trim()) filter.customerEmail = args.customerEmail.trim();
  if (args.status?.trim()) filter.status = args.status.trim();
  return filter;
}

function identityFilter(id: string, projectKey: string): Filter<Document> {
  const identities: Document[] = [{ subscriptionNumber: id }];
  if (ObjectId.isValid(id) && id.length === 24) identities.push({ _id: new ObjectId(id) });
  return { projectKey, $or: identities };
}

function matches(doc: Document, args: SubscriptionListArgs) {
  if (doc.projectKey !== resolveProjectKey(args.projectKey)) return false;
  if (args.customerId?.trim() && doc.customerId !== args.customerId.trim()) return false;
  if (args.customerEmail?.trim() && doc.customerEmail !== args.customerEmail.trim()) return false;
  return !args.status?.trim() || doc.status === args.status.trim();
}

function matchesIdentity(doc: Document, id: string, projectKey: string) {
  const documentId = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? "");
  return doc.projectKey === projectKey && (documentId === id || doc.subscriptionNumber === id);
}

function cleanDraft(draft: SubscriptionUpdate): Document {
  const allowed = ["ownerType", "customerId", "customerName", "customerEmail", "businessAccountName", "status", "frequency", "startDate", "nextDeliveryDate", "endDate", "shippingAddress", "paymentMethod", "currencyCode", "discountLabel", "priceOverride", "cancellationReason", "lastOrderNumber", "linkedOrderNumbers", "lineItems"] as const;
  const result: Document = {};
  for (const key of allowed) if (draft[key] !== undefined) result[key] = draft[key];
  return result;
}

function validateDraft(draft: SubscriptionDraft) {
  if (!draft.customerName.trim() || !draft.customerEmail.trim()) throw new Error("Customer name and email are required");
  if (!draft.nextDeliveryDate || !draft.shippingAddress.trim() || !draft.paymentMethod.trim()) throw new Error("Next delivery, shipping address and payment method are required");
  validateLineItems(draft.lineItems);
}

function validateLineItems(items: SubscriptionDraft["lineItems"]) {
  if (!items.length || items.some((item) => !item.sku.trim() || item.quantity < 1 || item.unitPrice < 0)) throw new Error("Each subscription item requires a SKU, quantity and non-negative unit price");
}

function history(action: string, actor: string, note?: string | null) {
  return { id: `history-${new ObjectId().toHexString()}`, action, actor, createdAt: new Date().toISOString(), note: note?.trim() || null };
}

async function nextSubscriptionNumber(projectKey: string) {
  const dbName = env("MONGO_DB_NAME") || "csa";
  const counters = await getMongoCollection<Document & { _id: string; seq: number }>(env("MONGO_SUBSCRIPTIONS_COUNTERS_COLLECTION") || "counters", { dbName });
  const updated = await counters.findOneAndUpdate({ _id: `subscription:${projectKey}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  const sequence = (updated as { seq?: number } | null)?.seq ?? (updated as { value?: { seq?: number } } | null)?.value?.seq;
  if (typeof sequence !== "number") throw new Error("Subscription counter did not return a sequence value");
  return `SUB-${String(sequence).padStart(5, "0")}`;
}

function memorySubscriptionNumber() {
  return `SUB-DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function advanceCycle(value: string, frequency: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Subscription has an invalid next delivery date");
  if (frequency === "Weekly") date.setUTCDate(date.getUTCDate() + 7);
  else if (frequency === "Every 2 weeks") date.setUTCDate(date.getUTCDate() + 14);
  else if (frequency === "Quarterly") date.setUTCMonth(date.getUTCMonth() + 3);
  else if (frequency === "Yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function resolveProjectKey(value?: string | null) {
  return value?.trim() || process.env.SUBSCRIPTIONS_PROJECT_KEY?.trim() || "default";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.floor(value), min), max);
}

function usesMemoryStore() {
  return !process.env.MONGO_URI?.trim();
}
