import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nativeSla, statusClass, type SlaEvent } from "./native-sla.js";
import { addWorklog, createTicket, getTicket, listTickets, updateTicket } from "./repository.js";

const start = Date.parse("2026-01-01T00:00:00Z");
const at = (minutes: number) => new Date(start + minutes * 60_000);
const iso = (minutes: number) => at(minutes).toISOString();
const policy = { startedAt: at(0), targets: { high: { firstResponseMinutes: 60, resolutionMinutes: 480 }, normal: { resolutionMinutes: 1440 } } };
const status = (s: "open" | "active" | "paused" | "done", minutes: number): SlaEvent => ({ type: "status", status: s, at: at(minutes) });
const action = (minutes: number): SlaEvent => ({ type: "action", at: at(minutes) });
const stages = (events: SlaEvent[], priority = "High") => nativeSla(policy, events, priority).metrics.map((m) => [m.key, m.stage, m.dueAt, m.completedAt]);

it("classifies native statuses", () => {
  expect(["Open", "In Progress", "Pending", "waiting", "Resolved", "closed"].map(statusClass)).toEqual(["open", "active", "paused", "paused", "done", "done"]);
});

it("runs both clocks from creation until something happens", () => {
  expect(stages([status("open", 0)])).toEqual([
    ["first_response", "running", iso(60), null],
    ["resolution", "running", iso(480), null]
  ]);
  expect(nativeSla(policy, [status("open", 0)], "High").nextDueAt).toBe(iso(60));
});

it("stops first response at the first agent action, met or missed", () => {
  expect(stages([status("open", 0), action(30), action(45)])[0]).toEqual(["first_response", "met", iso(60), iso(30)]);
  expect(stages([status("open", 0), action(90)])[0]).toEqual(["first_response", "missed", iso(60), iso(90)]);
});

it("pauses on Pending and pushes deadlines out by the time paused", () => {
  const paused = [status("open", 0), status("paused", 10), action(10)];
  // First response happened as the ticket went Pending; resolution has no fixed deadline while paused.
  expect(stages(paused)).toEqual([
    ["first_response", "met", iso(60), iso(10)],
    ["resolution", "paused", null, null]
  ]);
  expect(nativeSla(policy, paused, "High").nextDueAt).toBeNull();
  expect(stages([...paused, status("active", 130)])[1]).toEqual(["resolution", "running", iso(480 + 120), null]);
});

it("counts pause time before a first response that happens while paused", () => {
  expect(stages([status("open", 0), status("paused", 50), action(100)])[0]).toEqual(["first_response", "met", iso(60 + 50), iso(100)]);
});

it("does not count time spent resolved before a reopen", () => {
  const events = [status("open", 0), status("active", 5), action(5), status("done", 100), status("active", 400), status("done", 700)];
  // Resolution target 480 + 300 minutes resolved = due at 780; finished at 700.
  expect(stages(events)[1]).toEqual(["resolution", "met", iso(780), iso(700)]);
});

it("uses the ticket's current priority, treating Medium as normal", () => {
  expect(stages([status("open", 0)], "Medium")).toEqual([["resolution", "running", iso(1440), null]]);
  expect(stages([status("open", 0)], "Low")).toEqual([]);
});

it("reports no SLA for tickets created before a policy existed", () => {
  expect(nativeSla(undefined, undefined, "High")).toEqual({ source: "native", nextDueAt: null, metrics: [] });
});

describe("native repository", () => {
  beforeEach(() => vi.stubEnv("MONGO_URI", ""));
  afterEach(() => vi.unstubAllEnvs());
  const owner = { clientId: "sla-client", includeLegacy: false };
  const targets = { high: { firstResponseMinutes: 60, resolutionMinutes: 480 } };

  it("tracks a ticket's clocks through assignment, pending and resolution", async () => {
    const projectKey = "sla-flow";
    const created = await createTicket({ projectKey, subject: "Broken order", priority: "High", status: "Open" }, owner, targets);
    expect(created.sla?.metrics.map((m) => m.stage)).toEqual(["running", "running"]);

    // Re-saving an unassigned Open ticket is not a response.
    await updateTicket(created.id, { projectKey, subject: "Broken order (edited)", assignee: "Queue" }, owner);
    expect((await getTicket(created.id, projectKey, owner))?.sla?.metrics[0].stage).toBe("running");

    await updateTicket(created.id, { projectKey, assignee: "rep@example.com" }, owner);
    expect((await getTicket(created.id, projectKey, owner))?.sla?.metrics[0].stage).toBe("met");

    await updateTicket(created.id, { projectKey, status: "Pending" }, owner);
    expect((await getTicket(created.id, projectKey, owner))?.sla?.metrics[1].stage).toBe("paused");

    await updateTicket(created.id, { projectKey, status: "Resolved" }, owner);
    expect((await getTicket(created.id, projectKey, owner))?.sla?.metrics[1].stage).toBe("met");
  });

  it("counts an internal note as the first response", async () => {
    const projectKey = "sla-note";
    const created = await createTicket({ projectKey, subject: "Question", priority: "high" }, owner, targets);
    const noted = await addWorklog(created.id, { id: "n1", comment: "Looking into it", createdAt: "now", status: "internal" }, projectKey, owner);
    expect(noted?.sla?.metrics[0].stage).toBe("met");
  });

  it("leaves tickets without a policy, or created before one, with no SLA", async () => {
    const projectKey = "sla-none";
    const ticket = await createTicket({ projectKey, subject: "No policy", priority: "High" }, owner);
    expect(ticket.sla).toEqual({ source: "native", nextDueAt: null, metrics: [] });
  });

  it("sorts by soonest running deadline with no-SLA tickets last", async () => {
    const projectKey = "sla-sort";
    const none = await createTicket({ projectKey, subject: "none" }, owner);
    const later = await createTicket({ projectKey, subject: "later", priority: "Medium" }, owner, { normal: { resolutionMinutes: 600 } });
    const soon = await createTicket({ projectKey, subject: "soon", priority: "High" }, owner, targets);
    const page = await listTickets({ projectKey, sortKey: "slaDueAt" }, owner);
    expect(page.results.map((t) => t.id)).toEqual([soon.id, later.id, none.id]);
  });
});

describe("SLA state against the current time", () => {
  it("resolves running clocks to on track, at risk or breached, and picks the focus clock", async () => {
    const { metricState, slaFocus, ticketSlaState } = await import("./sla.js");
    const sla = nativeSla(policy, [status("open", 0)], "High");
    // First response is due 60 minutes in, so it is at risk from the start; resolution (480) is not.
    expect(metricState(sla.metrics[1], start)).toBe("on_track");
    expect(metricState(sla.metrics[0], start)).toBe("at_risk");
    expect(metricState(sla.metrics[0], start + 61 * 60_000)).toBe("breached");
    expect(slaFocus(sla, start)?.metric.key).toBe("first_response");
    expect(ticketSlaState(sla, start + 61 * 60_000)).toBe("breached");
    const done = nativeSla(policy, [status("open", 0), action(5), status("done", 10)], "High");
    expect(slaFocus(done, start)).toBeNull();
    expect(ticketSlaState(done, start)).toBe("done");
    expect(ticketSlaState(nativeSla(undefined, [], "High"), start)).toBe("none");
  });
});
