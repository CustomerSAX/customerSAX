import { expect, it } from "vitest";
import { formatSlaDuration, metricState, primaryMetric, SLA_AT_RISK_MS, ticketSlaState } from "./sla";
import type { SlaMetric } from "./types/ticket-types";

const now = Date.parse("2026-01-01T12:00:00Z");
const running = (msFromNow: number, key = "first_response"): SlaMetric => ({
  key,
  label: key,
  stage: "running",
  dueAt: new Date(now + msFromNow).toISOString(),
});

it("derives on track, at risk and breached only for running clocks", () => {
  expect(metricState(running(SLA_AT_RISK_MS + 60_000), now)).toBe("on_track");
  expect(metricState(running(SLA_AT_RISK_MS), now)).toBe("at_risk");
  expect(metricState(running(-1), now)).toBe("breached");
  expect(metricState({ key: "x", label: "x", stage: "running", dueAt: null }, now)).toBe("unknown");
  expect(metricState({ key: "x", label: "x", stage: "met", dueAt: new Date(now - 1).toISOString() }, now)).toBe("met");
});

it("shows the soonest running clock, else the most notable outstanding outcome", () => {
  const sla = { source: "zendesk", metrics: [running(5 * 3600_000, "resolution"), running(-60_000, "first_response")] };
  expect(primaryMetric(sla, now)?.metric.key).toBe("first_response");
  const settled = { source: "freshdesk", metrics: [{ key: "a", label: "a", stage: "met" as const }, { key: "b", label: "b", stage: "missed" as const }] };
  expect(primaryMetric(settled, now)?.state).toBe("missed");
});

it("never surfaces finished clocks on a row", () => {
  // Zendesk's achieved first reply on an open ticket: nothing is outstanding.
  const done = { source: "zendesk", metrics: [{ key: "first_reply_time", label: "First reply", stage: "completed" as const, dueAt: null }] };
  expect(primaryMetric(done, now)).toBeNull();
  expect(ticketSlaState(done, now)).toBe("done");
});

it("separates no SLA data from no SLA policy", () => {
  expect(ticketSlaState(null, now)).toBe("unavailable");
  expect(ticketSlaState({ source: "zendesk", metrics: [] }, now)).toBe("none");
});

it("formats compact durations", () => {
  expect(formatSlaDuration(80 * 60_000, "en-US")).toBe("1h 20m");
  expect(formatSlaDuration(-(2 * 1440 + 180) * 60_000, "en-US")).toBe("2d 3h");
  expect(formatSlaDuration(10_000, "en-US")).toBe("1m");
});
