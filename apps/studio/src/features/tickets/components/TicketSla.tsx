"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@csa/ui";
import { formatDateTime } from "@/lib/format-date";
import { formatSlaDuration, metricState, primaryMetric, type SlaState } from "../sla";
import type { SlaMetric, TicketSla } from "../types/ticket-types";

const VARIANTS: Record<SlaState, "primary" | "warning" | "error" | "success" | "neutral"> = {
  on_track: "success",
  at_risk: "warning",
  breached: "error",
  missed: "error",
  met: "success",
  paused: "neutral",
  completed: "neutral",
  unknown: "neutral",
};

function useStateText() {
  const t = useTranslations("Tickets.sla");
  const locale = useLocale();
  return (metric: SlaMetric, state: SlaState, now: number) => {
    if ((state === "on_track" || state === "at_risk") && metric.dueAt)
      return t("dueIn", { time: formatSlaDuration(Date.parse(metric.dueAt) - now, locale) });
    if (state === "breached" && metric.dueAt)
      return t("overdue", { time: formatSlaDuration(now - Date.parse(metric.dueAt), locale) });
    return t(`state.${state}`);
  };
}

/** One-line SLA status for a ticket row: the clock that needs attention soonest, if any. */
export function SlaBadge({ sla, now }: { sla: TicketSla | null | undefined; now: number }) {
  const t = useTranslations("Tickets.sla");
  const text = useStateText();
  if (!sla) return <span className="text-xs text-m-text-subtle">{t("unavailable")}</span>;
  if (!sla.metrics.length) return <span className="text-xs text-m-text-muted">{t("none")}</span>;
  const primary = primaryMetric(sla, now);
  if (!primary) return <span className="text-xs text-m-text-muted">{t("nothingDue")}</span>;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant={VARIANTS[primary.state]} size="sm" dot={primary.state === "breached" || primary.state === "at_risk"}>
        {text(primary.metric, primary.state, now)}
      </Badge>
      <span className="text-[11px] text-m-text-muted">{primary.metric.label}</span>
    </div>
  );
}

/** Every SLA clock on a ticket with its exact deadline and, when finished, completion time. */
export function SlaTimers({ sla, now }: { sla: TicketSla | null | undefined; now: number }) {
  const t = useTranslations("Tickets.sla");
  const locale = useLocale();
  const text = useStateText();
  if (!sla) return <span className="text-m-text-subtle">{t("unavailableDetail")}</span>;
  if (!sla.metrics.length) return <span className="text-m-text-muted">{t("noneDetail")}</span>;
  return (
    <ul className="flex flex-col gap-2">
      {sla.metrics.map((metric) => {
        const state = metricState(metric, now);
        return (
          <li key={metric.key} className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-m-text">{metric.label}</span>
              <Badge variant={VARIANTS[state]} size="sm" dot={state === "breached" || state === "at_risk"}>
                {text(metric, state, now)}
              </Badge>
            </div>
            <span className="text-[12px] text-m-text-muted">
              {metric.dueAt ? t("dueAt", { date: formatDateTime(metric.dueAt, locale) }) : t("noDueTime")}
              {metric.completedAt ? ` · ${t("completedAt", { date: formatDateTime(metric.completedAt, locale) })}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
