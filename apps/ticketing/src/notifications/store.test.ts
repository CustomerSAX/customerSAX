import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { listNotifications, markNotificationsRead, publishTicketNotification } from "./store.js";
import type { Ticket } from "../tickets/types.js";
let clientId: string;
beforeEach(() => { vi.stubEnv("MONGO_URI", ""); vi.stubEnv("NODE_ENV", "test"); clientId = randomUUID(); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
function ticket(assignee: string, projectKey = "project-a"): Ticket { return { id: randomUUID(), ticketNumber: "T1", projectKey, assignee, subject: "Help", status: "Open", priority: "normal", comments: [], attachments: [], history: [] }; }
function scope(userEmail = "agent@example.com", projectKey = "project-a") { return { clientId, projectKey, userEmail }; }
it("isolates client, project and agent; includes unassigned queue tickets", async () => {
  await publishTicketNotification(clientId, ticket("Agent@Example.com"), "New ticket");
  await publishTicketNotification(clientId, ticket("other@example.com"), "Private assignment");
  await publishTicketNotification(clientId, ticket("Queue"), "Queue ticket");
  await publishTicketNotification(clientId, ticket("agent@example.com", "project-b"), "Other project");
  await publishTicketNotification("other-client", ticket("Queue"), "Other client");
  const feed = await listNotifications(scope());
  expect(feed.items.map(item => item.title).sort()).toEqual(["New ticket", "Queue ticket"]);
  expect(feed.unreadCount).toBe(2);
});
it("keeps read state per agent and prevents reading another agent's notification", async () => {
  await publishTicketNotification(clientId, ticket("Queue"), "Queue ticket");
  const feed = await listNotifications(scope());
  await markNotificationsRead(scope(), feed.items[0].id);
  expect((await listNotifications(scope())).unreadCount).toBe(0);
  expect((await listNotifications(scope("other@example.com"))).unreadCount).toBe(1);
  await publishTicketNotification(clientId, ticket("other@example.com"), "Assigned");
  const other = await listNotifications(scope("other@example.com"));
  const assigned = other.items.find(item => item.title === "Assigned")!;
  await markNotificationsRead(scope(), assigned.id);
  expect((await listNotifications(scope("other@example.com"))).items.find(item => item.id === assigned.id)?.read).toBe(false);
});
it("marks only the displayed snapshot read, preserving newly arriving events", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  await publishTicketNotification(clientId, ticket("Queue"), "First");
  const feed = await listNotifications(scope());
  vi.advanceTimersByTime(1000);
  await publishTicketNotification(clientId, ticket("Queue"), "Second");
  await markNotificationsRead(scope(), undefined, feed.asOf);
  expect((await listNotifications(scope())).unreadCount).toBe(1);
});
it("notifies both old and new assignees on reassignment", async () => {
  await publishTicketNotification(clientId, ticket("new@example.com"), "Assignment changed", "old@example.com");
  expect((await listNotifications(scope("old@example.com"))).unreadCount).toBe(1);
  expect((await listNotifications(scope("new@example.com"))).unreadCount).toBe(1);
  expect((await listNotifications(scope("unrelated@example.com"))).unreadCount).toBe(0);
});
