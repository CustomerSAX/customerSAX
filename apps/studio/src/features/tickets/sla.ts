"use client";

import { useEffect, useState } from "react";
import type { SlaMetric, SlaStage, TicketSla } from "./types/ticket-types";

/** A running clock with this little time left is flagged "at risk". */
export const SLA_AT_RISK_MS = 60 * 60 * 1000;

/** Server sort key that orders tickets by soonest running SLA deadline. */
export const SLA_SORT_KEY = "slaDueAt";

export type SlaState = Exclude<SlaStage, "running"> | "on_track" | "at_risk" | "breached";
export type TicketSlaState = SlaState | "none" | "done" | "unavailable";

export function metricState(metric: SlaMetric, now: number): SlaState {
  if (metric.stage !== "running") return metric.stage;
  const due = metric.dueAt ? Date.parse(metric.dueAt) : Number.NaN;
  if (Number.isNaN(due)) return "unknown";
  const left = due - now;
  return left < 0 ? "breached" : left <= SLA_AT_RISK_MS ? "at_risk" : "on_track";
}

// Settled outcomes that still need attention, most notable first. Met/completed
// clocks need nothing, so a row never surfaces them (the detail page still does).
const OUTSTANDING_ORDER: SlaState[] = ["missed", "paused", "unknown"];

/** The clock a ticket row shows: its soonest running one, otherwise its most notable outstanding one. */
export function primaryMetric(sla: TicketSla | null | undefined, now: number) {
  if (!sla?.metrics.length) return null;
  const running = sla.metrics
    .filter((m) => m.stage === "running" && m.dueAt && !Number.isNaN(Date.parse(m.dueAt)))
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  if (running[0]) return { metric: running[0], state: metricState(running[0], now) };
  const outstanding = sla.metrics
    .map((metric) => ({ metric, state: metricState(metric, now) }))
    .filter(({ state }) => OUTSTANDING_ORDER.includes(state))
    .sort((a, b) => OUTSTANDING_ORDER.indexOf(a.state) - OUTSTANDING_ORDER.indexOf(b.state));
  return outstanding[0] ?? null;
}

/** "none" = no SLA policy applies; "done" = a policy applies but every clock has finished in a way needing nothing. */
export function ticketSlaState(sla: TicketSla | null | undefined, now: number): TicketSlaState {
  if (!sla) return "unavailable";
  if (!sla.metrics.length) return "none";
  return primaryMetric(sla, now)?.state ?? "done";
}

/** Compact localized duration, e.g. "2d 3h", "1h 20m", "15m". */
export function formatSlaDuration(ms: number, locale: string) {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const unit = (value: number, name: "day" | "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "narrow" }).format(value);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) return hours ? `${unit(days, "day")} ${unit(hours, "hour")}` : unit(days, "day");
  if (hours) return mins ? `${unit(hours, "hour")} ${unit(mins, "minute")}` : unit(hours, "hour");
  return unit(mins, "minute");
}

/** Current time, re-read on an interval so countdowns move without a refetch. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
