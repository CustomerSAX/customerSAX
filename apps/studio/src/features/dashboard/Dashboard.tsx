"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Badge } from "@csa/ui";
import { AppShell } from "../../components/shell/AppShell";
import { PageHeader } from "../workspace/PageHeader";
import { SectionCard, SummaryCard, SummaryGrid } from "@csa/ui";
import { useTicketStore } from "../tickets/hooks/use-tickets";
import type { Ticket, TicketPriority } from "../tickets/types/ticket-types";

// A ticket is "open" (actionable / unresolved) when it is neither Resolved nor
// Closed. This bucket drives the Open Tickets KPI and the work queue.
function isOpen(ticket: Ticket): boolean {
  return ticket.status !== "Resolved" && ticket.status !== "Closed";
}

// "At-risk" is derived honestly from the real `priority` field — there is no
// SLA/due-date field on a ticket, so this is NOT a phantom SLA timer: it is the
// count of unresolved tickets a rep should look at first (High/Urgent priority).
function isAtRisk(ticket: Ticket): boolean {
  return isOpen(ticket) && (ticket.priority === "High" || ticket.priority === "Urgent");
}

function priorityBadgeVariant(
  priority: TicketPriority
): "error" | "warning" | "neutral" | "success" {
  switch (priority) {
    case "Urgent":
    case "High":
      return "error";
    case "Medium":
      return "warning";
    default:
      return "neutral";
  }
}

type ServiceStatus = "online" | "offline" | "unknown";
type ServiceHealth = { name: string; status: ServiceStatus };
type HealthState =
  { phase: "loading" } | { phase: "ok"; services: ServiceHealth[] } | { phase: "error" };

function useServiceHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          services?: ServiceHealth[];
        } | null;
        if (cancelled) return;
        if (!res.ok || !data?.ok || !Array.isArray(data.services)) {
          setState({ phase: "error" });
          return;
        }
        setState({ phase: "ok", services: data.services });
      } catch {
        if (!cancelled) setState({ phase: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function Dashboard() {
  const t = useTranslations("Dashboard");
  const formatter = useFormatter();
  const now = useNow({ updateInterval: 60_000 });

  // Real ticket data flows through the same authenticated Apollo path
  // (/api/graphql -> BFF -> ticketing) the tickets feature uses. `error` means
  // the backend is unreachable/unauthenticated; an empty `tickets` array with
  // no error means the backend legitimately returned zero.
  const { tickets, loading, error } = useTicketStore();

  const { openCount, atRiskCount, highCount, queue } = useMemo(() => {
    const open = tickets.filter(isOpen);
    const atRisk = tickets.filter(isAtRisk);
    const high = open.filter(
      (t) => t.priority === "High" || t.priority === "Urgent"
    ).length;
    const sortedQueue = [...open]
      .sort((a, b) => {
        const at = new Date(a.lastModifiedAt ?? a.createdAt ?? 0).getTime();
        const bt = new Date(b.lastModifiedAt ?? b.createdAt ?? 0).getTime();
        return bt - at;
      })
      .slice(0, 6);
    return {
      openCount: open.length,
      atRiskCount: atRisk.length,
      highCount: high,
      queue: sortedQueue
    };
  }, [tickets]);

  const health = useServiceHealth();

  // Locale-aware relative time from a real timestamp. `useNow` supplies the
  // same initial value during SSR and hydration, then refreshes every minute.
  const relativeTime = (iso?: string): string => {
    if (!iso) return "—";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "—";

    const diffMs = then - now.getTime();
    const minutes = Math.round(diffMs / 60_000);
    if (Math.abs(minutes) < 1) return t("justNow");
    return formatter.relativeTime(new Date(then), now);
  };

  // Honest KPI values: real number when the backend answered, "…" while
  // loading, "—" (with an explicit reason) when the backend is unreachable.
  const ticketKpiValue = (value: number): string => {
    if (error) return "—";
    if (loading && tickets.length === 0) return "…";
    return String(value);
  };
  const ticketKpiSubtitle = (subtitle: string): string => {
    if (error) return t("ticketingUnavailable");
    if (loading && tickets.length === 0) return t("loading");
    return subtitle;
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          description={t("description")}
          eyebrow={t("eyebrow")}
          title={t("title")}
        />

        {/* KPI tiles */}
        <SummaryGrid>
          <SummaryCard
            icon="inbox"
            label={t("openTickets")}
            value={ticketKpiValue(openCount)}
            sub={ticketKpiSubtitle(
              highCount > 0
                ? t("highPriority", { count: highCount })
                : t("activeUnresolved")
            )}
            tone="primary"
          />
          <SummaryCard
            icon="alert-triangle"
            label={t("atRisk")}
            value={ticketKpiValue(atRiskCount)}
            sub={ticketKpiSubtitle(t("unresolvedHighPriority"))}
            tone={atRiskCount > 0 && !error ? "warning" : "default"}
          />
          <SummaryCard
            icon="shopping-bag"
            label={t("ordersReviewed")}
            value="—"
            sub={t("notAvailable")}
          />
          <SummaryCard
            icon="sparkles"
            label={t("aiAssistResolved")}
            value="—"
            sub={t("notAvailable")}
          />
        </SummaryGrid>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard
            title={t("activeWorkQueue")}
            icon="list"
            bodyClassName="p-0 divide-y divide-m-border/60"
          >
            {loading && tickets.length === 0 ? (
              <p className="p-4 text-xs text-m-text-muted">{t("loadingTickets")}</p>
            ) : error ? (
              <p className="p-4 text-xs text-m-text-muted">
                {t("ticketingBackendUnavailable")}
              </p>
            ) : queue.length === 0 ? (
              <p className="p-4 text-xs text-m-text-muted">{t("noOpenTickets")}</p>
            ) : (
              queue.map((item) => (
                <div
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-m-surface-2/40"
                  key={item.id}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-m-primary">
                        {item.ticketNumber}
                      </span>
                      <span className="truncate text-xs font-semibold text-m-text">
                        {item.subject}
                      </span>
                    </div>
                    <p className="truncate text-xs text-m-text-muted">
                      {item.email || item.customerId || t("unknownCustomer")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={priorityBadgeVariant(item.priority)} size="sm" dot>
                      {t(`priority.${item.priority}`)}
                    </Badge>
                    <span className="text-[11px] font-medium text-m-text-muted">
                      {relativeTime(item.lastModifiedAt ?? item.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </SectionCard>

          {/* Sidebar */}
          <aside className="flex flex-col gap-5">
            <SectionCard title={t("assistantTitle")} icon="sparkles">
              <p className="text-xs leading-relaxed text-m-text-muted">
                {t("assistantDescription")}
              </p>
            </SectionCard>

            <SectionCard
              title={t("serviceHealth")}
              icon="activity"
              bodyClassName="p-0 divide-y divide-m-border/60"
            >
              {health.phase === "loading" ? (
                <p className="px-4 py-3 text-xs text-m-text-muted">
                  {t("checkingServices")}
                </p>
              ) : health.phase === "error" ? (
                <p className="px-4 py-3 text-xs text-m-text-muted">
                  {t("statusUnavailable")}
                </p>
              ) : (
                health.services.map((service) => (
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    key={service.name}
                  >
                    <span className="text-xs font-medium text-m-text">
                      {service.name}
                    </span>
                    <Badge
                      variant={
                        service.status === "online"
                          ? "success"
                          : service.status === "offline"
                            ? "error"
                            : "neutral"
                      }
                      size="sm"
                      dot
                    >
                      {t(`status.${service.status}`)}
                    </Badge>
                  </div>
                ))
              )}
            </SectionCard>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
