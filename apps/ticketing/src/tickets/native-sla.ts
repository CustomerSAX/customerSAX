import type { SlaMetric, SlaStage, TicketSla } from "./types.js";
import { ticketSla } from "./sla.js";

/**
 * Native-ticket SLA, derived entirely from what was recorded on the ticket:
 *
 *  - `slaPolicy` — the project's targets copied onto the ticket when it was
 *    created, so later policy edits never rewrite an existing ticket's clocks.
 *    Tickets created before a policy existed have none and report no SLA.
 *  - `slaEvents` — timestamped status changes and agent actions, appended by
 *    every write path (including automated ones).
 *
 * Clocks run 24/7 from creation. Pending pauses both clocks; time spent
 * resolved before a reopen does not count. The first agent action (leaving
 * Open, assigning to a person, a note, a customer email, resolving) stops the
 * first-response clock.
 */

export type SlaStatusClass = "open" | "active" | "paused" | "done";
export type SlaEvent = { type: "status"; status: SlaStatusClass; at: Date | string } | { type: "action"; at: Date | string };
export type SlaTarget = { firstResponseMinutes?: number | null; resolutionMinutes?: number | null };
export type SlaPolicySnapshot = { startedAt: Date | string; targets: Partial<Record<string, SlaTarget>> };

export function statusClass(status: string | null | undefined): SlaStatusClass {
  const key = String(status ?? "").trim().toLowerCase().replace(/[_-]/g, " ");
  if (!key || key === "open" || key === "new") return "open";
  if (["pending", "waiting", "on hold"].includes(key)) return "paused";
  if (["resolved", "closed", "solved"].includes(key)) return "done";
  return "active";
}

export function slaPriority(priority: string | null | undefined) {
  const key = String(priority ?? "").trim().toLowerCase();
  return key === "medium" ? "normal" : key;
}

/** Events a status change produces: the status itself, and an agent action unless it is back to Open. */
export function statusEvents(status: string, at: Date): SlaEvent[] {
  const cls = statusClass(status);
  return cls === "open" ? [{ type: "status", status: cls, at }] : [{ type: "status", status: cls, at }, { type: "action", at }];
}

const ms = (value: Date | string) => (value instanceof Date ? value.getTime() : Date.parse(value));
const iso = (value: number) => new Date(value).toISOString();

type Timeline = {
  pausedMs: number;
  pausedSince: number | null;
  firstResponseAt: number | null;
  firstResponsePausedMs: number;
  resolvedAt: number | null;
  resolvedPausedMs: number;
};

function replay(events: SlaEvent[]): Timeline {
  const t: Timeline = { pausedMs: 0, pausedSince: null, firstResponseAt: null, firstResponsePausedMs: 0, resolvedAt: null, resolvedPausedMs: 0 };
  const sorted = events
    .map((event, index) => ({ event, index, at: ms(event.at) }))
    .filter(({ at }) => !Number.isNaN(at))
    .sort((a, b) => a.at - b.at || a.index - b.index);
  for (const { event, at } of sorted) {
    if (event.type === "action") {
      if (t.firstResponseAt === null) {
        t.firstResponseAt = at;
        t.firstResponsePausedMs = t.pausedMs + (t.pausedSince !== null ? at - t.pausedSince : 0);
      }
      continue;
    }
    if (t.pausedSince !== null && event.status !== "paused") {
      t.pausedMs += at - t.pausedSince;
      t.pausedSince = null;
    }
    if (event.status === "done") {
      if (t.resolvedAt === null) {
        t.resolvedAt = at;
        t.resolvedPausedMs = t.pausedMs;
      }
    } else if (t.resolvedAt !== null) {
      // Reopened: the time it sat resolved doesn't count against either clock.
      t.pausedMs += at - t.resolvedAt;
      t.resolvedAt = null;
    }
    if (event.status === "paused" && t.pausedSince === null && t.resolvedAt === null) t.pausedSince = at;
  }
  return t;
}

function metric(key: string, label: string, startedAt: number, minutes: number, doneAt: number | null, pausedAtDone: number, t: Timeline): SlaMetric {
  const target = minutes * 60_000;
  if (doneAt !== null) {
    const dueAt = startedAt + target + pausedAtDone;
    const stage: SlaStage = doneAt <= dueAt ? "met" : "missed";
    return { key, label, stage, dueAt: iso(dueAt), completedAt: iso(doneAt) };
  }
  // While paused the deadline keeps moving, so there is no fixed due time to show.
  if (t.pausedSince !== null) return { key, label, stage: "paused", dueAt: null, completedAt: null };
  return { key, label, stage: "running", dueAt: iso(startedAt + target + t.pausedMs), completedAt: null };
}

export function nativeSla(policy: SlaPolicySnapshot | null | undefined, events: SlaEvent[] | null | undefined, priority: string | null | undefined): TicketSla {
  const startedAt = policy ? ms(policy.startedAt) : Number.NaN;
  if (!policy || Number.isNaN(startedAt)) return ticketSla("native", []);
  const target = policy.targets[slaPriority(priority)];
  const t = replay(events ?? []);
  const metrics: SlaMetric[] = [];
  if (target?.firstResponseMinutes)
    metrics.push(metric("first_response", "First response", startedAt, target.firstResponseMinutes, t.firstResponseAt, t.firstResponsePausedMs, t));
  if (target?.resolutionMinutes)
    metrics.push(metric("resolution", "Resolution", startedAt, target.resolutionMinutes, t.resolvedAt, t.resolvedPausedMs, t));
  return ticketSla("native", metrics);
}

/** Far-future stand-in so tickets with no running clock sort after every real deadline. */
export const NO_SLA_DUE = new Date("9999-12-31T00:00:00Z");

export function slaSortAt(sla: TicketSla) {
  return sla.nextDueAt ? new Date(sla.nextDueAt) : NO_SLA_DUE;
}
