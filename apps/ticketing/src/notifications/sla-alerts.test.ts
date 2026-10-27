import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTicket, updateTicket } from "../tickets/repository.js";
import { listNotifications } from "./store.js";
import { sweepSlaAlerts } from "./sla-alerts.js";

beforeEach(() => vi.stubEnv("MONGO_URI", ""));
afterEach(() => vi.unstubAllEnvs());

const clientId = "alert-client";
const owner = { clientId, includeLegacy: false };
const targets = { urgent: { firstResponseMinutes: 120, resolutionMinutes: 1440 } };
const titles = async (projectKey: string, userEmail: string) =>
  (await listNotifications({ clientId, projectKey, userEmail })).items.map((n) => `${n.ticketNumber} ${n.title}`);

it("alerts the team once when an unassigned ticket's clock is at risk, then once more on breach", async () => {
  const projectKey = "alert-flow";
  const ticket = await createTicket({ projectKey, subject: "Urgent", priority: "Urgent" }, owner, targets);
  const created = Date.parse(ticket.createdAt!);

  await sweepSlaAlerts(new Date(created + 30 * 60_000));
  expect(await titles(projectKey, "anyone@example.com")).toEqual([]);

  // 55 then 50 minutes left on first response: at risk. Repeated sweeps don't repeat the alert.
  await sweepSlaAlerts(new Date(created + 65 * 60_000));
  await sweepSlaAlerts(new Date(created + 70 * 60_000));
  expect(await titles(projectKey, "anyone@example.com")).toEqual([`${ticket.ticketNumber} First response SLA due within 1 hour`]);

  await sweepSlaAlerts(new Date(created + 121 * 60_000));
  await sweepSlaAlerts(new Date(created + 130 * 60_000));
  expect((await titles(projectKey, "anyone@example.com")).sort()).toEqual([
    `${ticket.ticketNumber} First response SLA breached`,
    `${ticket.ticketNumber} First response SLA due within 1 hour`
  ]);
});

it("alerts only the assignee, and stops once the clock is met", async () => {
  const projectKey = "alert-assigned";
  const ticket = await createTicket({ projectKey, subject: "Assigned", priority: "Urgent", assignee: "Queue" }, owner, targets);
  await updateTicket(ticket.id, { projectKey, assignee: "rep@example.com" }, owner);
  const created = Date.parse(ticket.createdAt!);

  // First response is met by the assignment; resolution is 24h out, so nothing is due soon.
  await sweepSlaAlerts(new Date(created + 115 * 60_000));
  expect(await titles(projectKey, "rep@example.com")).toEqual([]);

  await sweepSlaAlerts(new Date(created + (1440 - 30) * 60_000));
  expect(await titles(projectKey, "rep@example.com")).toEqual([`${ticket.ticketNumber} Resolution SLA due within 1 hour`]);
  expect(await titles(projectKey, "someone-else@example.com")).toEqual([]);
});

it("does not alert while a ticket is paused or for tickets without a policy", async () => {
  const projectKey = "alert-quiet";
  const paused = await createTicket({ projectKey, subject: "Waiting", priority: "Urgent", status: "Pending" }, owner, targets);
  await createTicket({ projectKey, subject: "No policy", priority: "Urgent" }, owner);
  await sweepSlaAlerts(new Date(Date.parse(paused.createdAt!) + 3 * 24 * 60 * 60_000));
  expect(await titles(projectKey, "anyone@example.com")).toEqual([]);
});
