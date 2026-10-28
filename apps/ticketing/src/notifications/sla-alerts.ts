import { createHash } from "node:crypto";
import { createLogger } from "@csa/logger";
import { ticketsWithSlaDueBy } from "../tickets/repository.js";
import { metricState, SLA_AT_RISK_MS } from "../tickets/sla.js";
import { publishTicketNotification } from "./store.js";

const log = createLogger("ticketing").child({ module: "notifications/sla-alerts" });

// Bounds one sweep; anything beyond is picked up by the next sweep.
const SWEEP_LIMIT = 500;

/**
 * Publishes a bell notification when a native ticket's SLA clock becomes at
 * risk (1 hour or less left) and again if it breaches. Each alert is keyed by
 * ticket, clock, deadline and state, so it fires once however many sweeps or
 * service instances see it; a deadline moved by a pause can alert afresh.
 * Recipients follow the usual rule: the assignee, or the whole project team
 * while unassigned. Zendesk/Freshdesk run their own SLA escalations.
 */
export async function sweepSlaAlerts(now = new Date()) {
  const due = await ticketsWithSlaDueBy(new Date(now.getTime() + SLA_AT_RISK_MS), SWEEP_LIMIT);
  let alerts = 0;
  for (const { clientId, ticket } of due) {
    for (const metric of ticket.sla?.metrics ?? []) {
      const state = metricState(metric, now.getTime());
      if (state !== "at_risk" && state !== "breached") continue;
      const id = createHash("sha256").update(JSON.stringify(["sla-alert", clientId, ticket.projectKey, ticket.id, metric.key, metric.dueAt, state])).digest("hex");
      const title = state === "breached" ? `${metric.label} SLA breached` : `${metric.label} SLA due within 1 hour`;
      await publishTicketNotification(clientId, ticket, title, undefined, id);
      alerts++;
    }
  }
  return alerts;
}

/** Runs the sweep on an interval (SLA_ALERT_INTERVAL_MS, default 60s; 0 disables). */
export function startSlaAlerts() {
  const interval = Number(process.env.SLA_ALERT_INTERVAL_MS ?? 60_000);
  if (!Number.isFinite(interval) || interval <= 0) {
    log.info("SLA alerts disabled", { interval: process.env.SLA_ALERT_INTERVAL_MS });
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await sweepSlaAlerts(); }
    catch (error) { log.error("SLA alert sweep failed", error); }
    finally { running = false; }
  };
  setInterval(() => void tick(), interval).unref();
  void tick();
}
