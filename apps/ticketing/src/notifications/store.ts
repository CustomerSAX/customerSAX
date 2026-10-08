import { createHash, randomUUID } from "node:crypto";
import { getMongoCollection } from "@csa/mongodb";
import type { Ticket } from "../tickets/types.js";

export type NotificationScope = { clientId: string; projectKey: string; userEmail: string };
type Event = { _id: string; clientId: string; projectKey: string; ticketId: string; ticketNumber: string; title: string; subject: string; createdAt: string; recipients: string[]; readBy: string[] };
const memory: Event[] = [];
const normalize = (value: string) => value.trim().toLowerCase();
const inMemory = () => !process.env.MONGO_URI?.trim() && process.env.NODE_ENV !== "production";
let indexReady: Promise<unknown> | undefined;
async function collection() {
  const col = await getMongoCollection<Event>("csa_ticket_notifications", { dbName: process.env.MONGO_DB_NAME || process.env.MONGO_TICKETS_DB || "csa" });
  if (!indexReady) indexReady = col.createIndex({ clientId: 1, projectKey: 1, createdAt: -1 }).catch(error => { indexReady = undefined; throw error; });
  await indexReady;
  return col;
}
function audience(assignee?: string | null) {
  return assignee?.includes("@") ? normalize(assignee) : "*";
}
function visible(event: Event, scope: NotificationScope) {
  return event.clientId === scope.clientId && event.projectKey === scope.projectKey && (event.recipients.includes("*") || event.recipients.includes(normalize(scope.userEmail)));
}
function filter(scope: NotificationScope) {
  return { clientId: scope.clientId, projectKey: scope.projectKey, recipients: { $in: ["*", normalize(scope.userEmail)] } };
}
export async function publishTicketNotification(clientId: string, ticket: Ticket, title: string, previousAssignee?: string | null) {
  const eventId = title === "Customer information requested" && ticket.informationRequest
    ? createHash("sha256").update(JSON.stringify([clientId, ticket.projectKey, ticket.id, ticket.informationRequest.createdAt, title])).digest("hex") : randomUUID();
  const event: Event = { _id: eventId, clientId, projectKey: ticket.projectKey, ticketId: ticket.id, ticketNumber: ticket.ticketNumber,
    title, subject: ticket.subject, createdAt: new Date().toISOString(), recipients: [...new Set([audience(ticket.assignee), ...(previousAssignee ? [audience(previousAssignee)] : [])])], readBy: [] };
  if (inMemory()) { if (!memory.some(item => item._id === event._id)) memory.push(event); return; }
  try { await (await collection()).insertOne(event); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
}
export async function listNotifications(scope: NotificationScope) {
  const asOf = new Date().toISOString();
  const email = normalize(scope.userEmail);
  let events: Event[];
  let unreadCount: number;
  if (inMemory()) {
    const all = memory.filter(event => visible(event, scope) && event.createdAt <= asOf);
    events = all.sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b._id.localeCompare(a._id)).slice(0, 50);
    unreadCount = all.filter(event => !event.readBy.includes(email)).length;
  } else {
    const col = await collection();
    const query = { ...filter(scope), createdAt: { $lte: asOf } };
    [events, unreadCount] = await Promise.all([col.find(query).sort({ createdAt: -1, _id: -1 }).limit(50).toArray(), col.countDocuments({ ...query, readBy: { $ne: email } })]);
  }
  return { asOf, unreadCount, items: events.map(({ _id, readBy, clientId: _client, projectKey: _project, recipients: _recipients, ...event }) => ({ ...event, id: _id, read: readBy.includes(email) })) };
}
export async function markNotificationsRead(scope: NotificationScope, id?: string, through?: string) {
  if (!id && (!through || !Number.isFinite(Date.parse(through)))) throw new Error("A notification snapshot is required");
  const cutoff = through ? new Date(Math.min(Date.parse(through), Date.now())).toISOString() : undefined;
  const email = normalize(scope.userEmail);
  if (inMemory()) {
    for (const event of memory) if (visible(event, scope) && (id ? event._id === id : event.createdAt <= cutoff!) && !event.readBy.includes(email)) event.readBy.push(email);
  } else {
    await (await collection()).updateMany({ ...filter(scope), ...(id ? { _id: id } : { createdAt: { $lte: cutoff! } }) }, { $addToSet: { readBy: email } });
  }
  return true;
}
