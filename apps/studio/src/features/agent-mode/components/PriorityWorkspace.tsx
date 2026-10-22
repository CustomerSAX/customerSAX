"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon, Button, StatusPill } from "@csa/ui";
import { useQuery } from "@apollo/client";
import { ORDERS_PAGE_QUERY } from "@/features/orders/api/queries";
import { gql } from "@apollo/client";
import { TaskResolutionPanel } from "./TaskResolutionPanel";
import type { AgentTask, QueueFilterTab, TaskUrgencyLevel } from "../types";

// Reusable Quotes query for lightweight metadata
const AGENT_QUOTES_QUERY = gql`
  query AgentQuotesPage($limit: Int!, $offset: Int!) {
    quotes(limit: $limit, offset: $offset, sortKey: "lastModifiedAt", sortOrder: "desc") {
      results {
        id
        key
        quoteNumber
        companyName
        customerEmail
        status
        lineItemCount
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        createdAt
        lastModifiedAt
      }
    }
  }
`;

interface RawTicket {
  id: string;
  ticketNumber?: string;
  subject?: string;
  status?: string;
  priority?: string;
  category?: string;
  customerName?: string;
  customerEmail?: string;
  orderNumber?: string;
  createdAt?: string;
  lastModifiedAt?: string;
}

interface RawOrder {
  id: string;
  orderNumber?: string;
  customerEmail?: string;
  state?: string;
  orderState?: string;
  shipmentState?: string;
  paymentState?: string;
  createdAt?: string;
  totalPrice?: { centAmount?: number; fractionDigits?: number; currencyCode?: string };
  lineItems?: Array<{ id: string; name?: string; quantity?: number }>;
  returnInfo?: Array<{ returnTrackingId?: string; items?: unknown[] }>;
}

interface RawQuote {
  id: string;
  key?: string;
  quoteNumber?: string;
  companyName?: string;
  customerEmail?: string;
  status?: string;
  lineItemCount?: number;
  totalPrice?: { centAmount?: number; fractionDigits?: number; currencyCode?: string };
  createdAt?: string;
  lastModifiedAt?: string;
}

function statusTone(status?: string): "success" | "warning" | "error" | "neutral" | "primary" | "info" {
  const s = (status ?? "").toLowerCase();
  if (s === "resolved" || s === "closed" || s === "complete" || s === "delivered") return "success";
  if (s === "delayed" || s === "urgent") return "error";
  if (s === "in_progress" || s === "in review" || s === "submitted" || s === "pending") return "warning";
  if (s === "open" || s === "new") return "primary";
  return "neutral";
}

interface PriorityWorkspaceProps {
  onAnalyzeTask: (task: AgentTask) => void;
  selectedTask: AgentTask | null;
  onSelectTask: (task: AgentTask | null) => void;
  isInvestigating?: boolean;
}

export function PriorityWorkspace({
  onAnalyzeTask,
  selectedTask,
  onSelectTask,
  isInvestigating = false,
}: PriorityWorkspaceProps) {
  const [filterTab, setFilterTab] = useState<QueueFilterTab>("all");
  const [tickets, setTickets] = useState<AgentTask[]>([]);
  const [ticketLoading, setTicketLoading] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // ── 1. Deterministic Ticket Fetch (REST API proxy -> BFF) ───────────────
  const fetchTickets = useCallback(async () => {
    setTicketLoading(true);
    setTicketError(null);
    try {
      // Lightweight fetch: open tickets only, limit 15, no AI processing
      const res = await fetch("/api/tickets?status=open&limit=15");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results?: RawTicket[] };
      const raw = data.results ?? [];

      const mapped: AgentTask[] = raw.map((t) => {
        const p = (t.priority ?? "normal").toLowerCase() as TaskUrgencyLevel;
        let urgencyReason = "Open Ticket";
        if (p === "urgent") urgencyReason = "Urgent Priority";
        else if (p === "high") urgencyReason = "High Priority";
        else if (t.createdAt && Date.now() - new Date(t.createdAt).getTime() > 14400000) {
          urgencyReason = "SLA Attention (>4h)";
        }

        return {
          id: t.id,
          type: "ticket",
          referenceNumber: t.ticketNumber || t.id.slice(0, 8),
          title: t.subject || "Customer Inquiry",
          customerName: t.customerName || t.customerEmail || "Customer",
          customerEmail: t.customerEmail,
          status: t.status || "open",
          priority: p,
          urgencyReason,
          orderNumber: t.orderNumber,
          createdAt: t.createdAt,
          lastModifiedAt: t.lastModifiedAt,
          rawRecord: t,
        };
      });

      setTickets(mapped);
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setTicketLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ── 2. Deterministic Orders Fetch (GraphQL Apollo Client) ────────────────
  const { data: orderData, loading: orderLoading } = useQuery<{ orderPage?: { results?: RawOrder[] } }>(
    ORDERS_PAGE_QUERY,
    {
      variables: { limit: 6, offset: 0, sortKey: "createdAt", sortOrder: "desc" },
      fetchPolicy: "cache-first",
    }
  );

  const orders: AgentTask[] = useMemo(() => {
    const raw = orderData?.orderPage?.results ?? [];
    return raw.map((o) => {
      const isDelayed = o.shipmentState === "Delayed" || o.state === "Delayed";
      const hasReturn = (o.returnInfo?.length ?? 0) > 0;
      let priority: TaskUrgencyLevel = "normal";
      let urgencyReason = "Recent Order";

      if (isDelayed) {
        priority = "urgent";
        urgencyReason = "Delayed in Transit";
      } else if (hasReturn) {
        priority = "high";
        urgencyReason = "Return Requested";
      }

      const totalCent = o.totalPrice?.centAmount ?? 0;
      const frac = o.totalPrice?.fractionDigits ?? 2;
      const totalStr = `$${(totalCent / Math.pow(10, frac)).toFixed(2)}`;

      return {
        id: o.id,
        type: "order",
        referenceNumber: o.orderNumber || o.id.slice(0, 8),
        title: `Order ${o.orderNumber || o.id.slice(0, 8)} (${o.lineItems?.length ?? 0} items)`,
        customerEmail: o.customerEmail,
        customerName: o.customerEmail || "Customer",
        status: o.shipmentState || o.orderState || o.state || "Complete",
        priority,
        urgencyReason,
        totalPrice: totalStr,
        createdAt: o.createdAt,
        rawRecord: o,
      };
    });
  }, [orderData]);

  // ── 3. Deterministic Quotes Fetch (GraphQL Apollo Client) ────────────────
  const { data: quoteData, loading: quoteLoading } = useQuery<{ quotes?: { results?: RawQuote[] } }>(
    AGENT_QUOTES_QUERY,
    {
      variables: { limit: 5, offset: 0 },
      fetchPolicy: "cache-first",
    }
  );

  const quotes: AgentTask[] = useMemo(() => {
    const raw = quoteData?.quotes?.results ?? [];
    return raw.map((q) => {
      const isPending = q.status === "Submitted" || q.status === "In Review";
      const priority: TaskUrgencyLevel = isPending ? "high" : "normal";
      const urgencyReason = isPending ? "Pending Review" : "Active Quote";

      const totalCent = q.totalPrice?.centAmount ?? 0;
      const frac = q.totalPrice?.fractionDigits ?? 2;
      const totalStr = `$${(totalCent / Math.pow(10, frac)).toFixed(2)}`;

      return {
        id: q.id,
        type: "quote",
        referenceNumber: q.quoteNumber || q.key || q.id.slice(0, 8),
        title: `Quote ${q.quoteNumber || q.key || q.id.slice(0, 8)} • ${q.companyName || "Commercial"}`,
        customerEmail: q.customerEmail,
        customerName: q.companyName || q.customerEmail || "Business Account",
        status: q.status || "Draft",
        priority,
        urgencyReason,
        totalPrice: totalStr,
        createdAt: q.createdAt,
        lastModifiedAt: q.lastModifiedAt,
        rawRecord: q,
      };
    });
  }, [quoteData]);

  // ── Combined & Deterministically Ranked Queue ────────────────────────────
  const allTasks = useMemo(() => {
    const combined = [...tickets, ...orders, ...quotes];

    const urgencyWeight: Record<TaskUrgencyLevel, number> = {
      urgent: 3,
      high: 2,
      normal: 1,
      low: 0,
    };

    const typeWeight: Record<string, number> = {
      ticket: 3, // Tickets have highest priority
      order: 2,  // Orders second
      quote: 1,  // Quotes third
    };

    return combined.sort((a, b) => {
      const uA = urgencyWeight[a.priority ?? "normal"];
      const uB = urgencyWeight[b.priority ?? "normal"];
      if (uA !== uB) return uB - uA; // Highest urgency first

      const tA = typeWeight[a.type] ?? 0;
      const tB = typeWeight[b.type] ?? 0;
      if (tA !== tB) return tB - tA; // Ticket > Order > Quote

      // Finally, newest first
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }, [tickets, orders, quotes]);

  const filteredTasks = useMemo(() => {
    if (filterTab === "all") return allTasks;
    if (filterTab === "tickets") return allTasks.filter((t) => t.type === "ticket");
    if (filterTab === "orders") return allTasks.filter((t) => t.type === "order");
    if (filterTab === "quotes") return allTasks.filter((t) => t.type === "quote");
    return allTasks;
  }, [allTasks, filterTab]);

  const isLoading = ticketLoading && orderLoading && quoteLoading;

  if (selectedTask && selectedTask.type === "ticket") {
    return (
      <TaskResolutionPanel
        task={selectedTask}
        onBack={() => onSelectTask(null)}
        onInvestigateWithAI={onAnalyzeTask}
        isAssistantLoading={isInvestigating}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-m-bg border-l border-m-border overflow-hidden select-none">
      {/* ── Top Bar / Filter Tabs ── */}
      <div className="flex items-center justify-between border-b border-m-border bg-m-surface px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Icon name="list" size="sm" className="text-m-primary" />
          <h2 className="text-sm font-semibold text-m-text">Priority Queue</h2>
          <span className="ml-1 rounded-full bg-m-surface-2 px-2 py-0.5 text-xs text-m-text-muted">
            {allTasks.length}
          </span>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 rounded-lg border border-m-border bg-m-surface-2 p-0.5 text-xs">
          {(["all", "tickets", "orders", "quotes"] as QueueFilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setFilterTab(tab);
                onSelectTask(null);
              }}
              className={`px-2.5 py-1 rounded capitalize font-medium transition cursor-pointer ${
                filterTab === tab
                  ? "bg-m-surface text-m-text shadow-sm"
                  : "text-m-text-muted hover:text-m-text"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Workspace Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedTask ? (
          // ── SELECTED TASK VIEW (Detail + Explicit Analyze Action) ──
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectTask(null)}
                className="flex items-center gap-1.5 text-xs text-m-text-muted hover:text-m-text"
              >
                <Icon name="arrow-left" size="xs" />
                <span>Back to Priority Queue</span>
              </Button>

              <span className="text-[11px] text-m-text-muted uppercase tracking-wider font-semibold">
                Task Workspace
              </span>
            </div>

            {/* Task Card Header */}
            <div className="rounded-xl border border-m-border bg-m-surface p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-m-primary bg-m-primary/10 px-2 py-0.5 rounded">
                      {selectedTask.referenceNumber}
                    </span>
                    <span className="capitalize text-xs font-medium text-m-text-muted">
                      {selectedTask.type}
                    </span>
                    <StatusPill tone={statusTone(selectedTask.status)}>
                      {selectedTask.status}
                    </StatusPill>
                  </div>
                  <h3 className="text-base font-semibold text-m-text leading-snug">
                    {selectedTask.title}
                  </h3>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedTask.priority === "urgent"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : selectedTask.priority === "high"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-50 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {selectedTask.urgencyReason}
                  </span>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-m-border text-xs text-m-text-muted">
                <div>
                  <span className="font-medium text-m-text">Customer:</span>{" "}
                  {selectedTask.customerName} ({selectedTask.customerEmail || "No email"})
                </div>
                {selectedTask.orderNumber && (
                  <div>
                    <span className="font-medium text-m-text">Order Ref:</span>{" "}
                    <span className="font-mono">{selectedTask.orderNumber}</span>
                  </div>
                )}
                {selectedTask.totalPrice && (
                  <div>
                    <span className="font-medium text-m-text">Total Value:</span>{" "}
                    {selectedTask.totalPrice}
                  </div>
                )}
                {selectedTask.createdAt && (
                  <div>
                    <span className="font-medium text-m-text">Created:</span>{" "}
                    {new Date(selectedTask.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* AI Investigation Trigger Box */}
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
                <Icon name="sparkles" size="sm" className="text-indigo-600" />
                <span>On-Demand Investigation</span>
              </div>

              <p className="text-xs text-indigo-700/90 leading-relaxed">
                Zero LLM calls have been made for this task so far. Clicking <strong>Analyze Task</strong> will
                query only this item&apos;s verified records, check relevant shipment/order state, and propose an
                executable resolution plan.
              </p>

              <div className="pt-1">
                <Button
                  variant="primary"
                  onClick={() => onAnalyzeTask(selectedTask)}
                  disabled={isInvestigating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 font-medium shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
                >
                  <Icon name={isInvestigating ? "loader" : "sparkles"} size="sm" className={isInvestigating ? "animate-spin" : ""} />
                  <span>{isInvestigating ? "Investigating Task..." : "Analyze Task with AI"}</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // ── TASK QUEUE LIST ──
          <div className="space-y-2.5">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-m-text-muted space-y-2">
                <Icon name="loader" size="md" className="animate-spin text-m-primary mx-auto" />
                <p>Loading lightweight task metadata (0 LLM calls)...</p>
              </div>
            ) : ticketError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center space-y-2">
                <p className="text-xs text-red-700 font-medium">Failed to load priority tickets: {ticketError}</p>
                <Button size="sm" variant="outline" onClick={fetchTickets}>
                  Retry
                </Button>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-m-border p-12 text-center space-y-2">
                <Icon name="check-circle" size="lg" className="text-emerald-500 mx-auto" />
                <p className="text-sm font-medium text-m-text">Queue is clear</p>
                <p className="text-xs text-m-text-muted">No urgent tasks currently require intervention.</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={`${task.type}-${task.id}`}
                  onClick={() => onSelectTask(task)}
                  className="group rounded-xl border border-m-border bg-m-surface p-3.5 transition hover:border-indigo-300 hover:shadow-xs cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-m-text bg-m-surface-2 px-1.5 py-0.5 rounded">
                        {task.referenceNumber}
                      </span>
                      <span className="capitalize text-[11px] font-medium text-m-text-muted">
                        {task.type}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        task.priority === "urgent"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : task.priority === "high"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-50 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {task.urgencyReason}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold text-m-text line-clamp-1 group-hover:text-indigo-600 transition">
                      {task.title}
                    </h4>
                    <p className="text-xs text-m-text-muted line-clamp-1">
                      {task.customerName} {task.orderNumber ? `• Order #${task.orderNumber}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-m-border/60 text-[11px] text-m-text-muted">
                    <StatusPill tone={statusTone(task.status)}>
                      {task.status}
                    </StatusPill>
                    <span className="text-indigo-600 font-medium group-hover:underline">
                      Investigate →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
