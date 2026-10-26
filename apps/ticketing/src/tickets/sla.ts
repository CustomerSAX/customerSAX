import type { SlaMetric, SlaStage, Ticket, TicketSla } from "./types.js";

/** Sort key accepted by remote providers for "breaching soon" ordering. */
export const SLA_SORT_KEY = "slaDueAt";

/**
 * A running clock with this little time left is "at risk". The studio's live
 * countdown (apps/studio/src/features/tickets/sla.ts) uses the same window.
 */
export const SLA_AT_RISK_MS = 60 * 60 * 1000;

export type SlaState = Exclude<SlaStage, "running"> | "on_track" | "at_risk" | "breached";
/** Ticket-level: "none" = no SLA policy applies; "done" = every clock finished needing nothing. */
export type TicketSlaState = SlaState | "none" | "done";

export function metricState(metric: SlaMetric, now: number): SlaState {
  if (metric.stage !== "running") return metric.stage;
  const due = metric.dueAt ? Date.parse(metric.dueAt) : Number.NaN;
  if (Number.isNaN(due)) return "unknown";
  const left = due - now;
  return left < 0 ? "breached" : left <= SLA_AT_RISK_MS ? "at_risk" : "on_track";
}

// Settled outcomes that still need attention, most notable first; met/completed need nothing.
const OUTSTANDING: SlaState[] = ["missed", "paused", "unknown"];

/** The clock that needs attention soonest: the earliest running one, else the most notable outstanding one. */
export function slaFocus(sla: TicketSla | null | undefined, now: number): { metric: SlaMetric; state: SlaState } | null {
  if (!sla?.metrics.length) return null;
  const running = sla.metrics
    .filter((m) => m.stage === "running" && m.dueAt && !Number.isNaN(Date.parse(m.dueAt)))
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  if (running[0]) return { metric: running[0], state: metricState(running[0], now) };
  return (
    sla.metrics
      .map((metric) => ({ metric, state: metricState(metric, now) }))
      .filter(({ state }) => OUTSTANDING.includes(state))
      .sort((a, b) => OUTSTANDING.indexOf(a.state) - OUTSTANDING.indexOf(b.state))[0] ?? null
  );
}

export function ticketSlaState(sla: TicketSla, now: number): TicketSlaState {
  if (!sla.metrics.length) return "none";
  return slaFocus(sla, now)?.state ?? "done";
}

/** The earliest deadline among clocks still running; breached clocks sort first. */
export function nextDueAt(metrics: SlaMetric[]): string | null {
  const due = metrics
    .filter((m) => m.stage === "running" && m.dueAt && !Number.isNaN(Date.parse(m.dueAt)))
    .map((m) => m.dueAt!)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return due[0] ?? null;
}

export function ticketSla(source: TicketSla["source"], metrics: SlaMetric[]): TicketSla {
  return { source, nextDueAt: nextDueAt(metrics), metrics };
}

/** Soonest running deadline first; tickets with no running clock keep their incoming order, last. */
export function sortBySlaDue(tickets: Ticket[]) {
  const due = (t: Ticket) => (t.sla?.nextDueAt ? Date.parse(t.sla.nextDueAt) : Number.POSITIVE_INFINITY);
  return tickets
    .map((ticket, index) => ({ ticket, index }))
    .sort((a, b) => due(a.ticket) - due(b.ticket) || a.index - b.index)
    .map(({ ticket }) => ticket);
}
