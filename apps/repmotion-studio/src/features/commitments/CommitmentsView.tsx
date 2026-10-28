"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Icon, PageHeader } from "@/components/ui";
import { Metrics, Panel } from "../repmotion/components";
import { useDemo } from "../repmotion/demo-state";
import { initialCommitments } from "./data";
import { CommitmentCard } from "./components/CommitmentCard";
import { CommitmentFilters } from "./components/CommitmentFilters";
import { NewCommitmentModal, RescheduleModal } from "./components/CommitmentActionModals";
import type { CommitmentFilterState, CommitmentItem, CommitmentStatus } from "./types";

export function CommitmentsView() {
  const demo = useDemo();
  const [commitments, setCommitments] = useState<CommitmentItem[]>(initialCommitments);
  const [selectedForReschedule, setSelectedForReschedule] = useState<CommitmentItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [filterState, setFilterState] = useState<CommitmentFilterState>({
    searchQuery: "",
    statusFilter: "all",
    urgencyFilter: "all",
    accountFilter: "all",
    ownerFilter: "all"
  });

  const activeCommitments = commitments.filter((c) => c.status !== "Fulfilled");
  const fulfilledCommitments = commitments.filter((c) => c.status === "Fulfilled");
  const overdueCommitments = commitments.filter((c) => c.status === "Overdue" || c.urgency === "overdue");
  const todayCommitments = commitments.filter((c) => c.urgency === "today" && c.status !== "Fulfilled");
  const dependenciesCount = commitments.filter((c) => !!c.dependency && c.status !== "Fulfilled").length;

  /**
   * Focus-3: The top 3 commitments needing immediate action.
   * Priority order: overdue first, then today-due, sorted by how urgent the dependency is.
   */
  const focus3Commitments = [
    ...overdueCommitments,
    ...todayCommitments.filter((c) => c.status === "Open" || c.status === "In Progress")
  ]
    .filter((c) => c.status !== "Fulfilled")
    .slice(0, 3);

  const focus3Ids = new Set(focus3Commitments.map((c) => c.id));

  // Filter commitments based on active filter state
  const visibleCommitments = commitments.filter((item) => {
    const searchMatches =
      !filterState.searchQuery ||
      `${item.title} ${item.accountName} ${item.contact.name} ${item.categoryLabel} ${item.dependency || ""}`
        .toLowerCase()
        .includes(filterState.searchQuery.toLowerCase());

    const accountMatches =
      filterState.accountFilter === "all" || item.accountId === filterState.accountFilter;

    let urgencyMatches = true;
    if (filterState.urgencyFilter === "today") {
      urgencyMatches = item.urgency === "today" && item.status !== "Fulfilled";
    } else if (filterState.urgencyFilter === "overdue") {
      urgencyMatches = item.status === "Overdue" || item.urgency === "overdue";
    } else if (filterState.urgencyFilter === "this_week") {
      urgencyMatches = item.urgency === "this_week" && item.status !== "Fulfilled";
    } else if (filterState.urgencyFilter === "completed") {
      urgencyMatches = item.status === "Fulfilled";
    } else if (filterState.urgencyFilter === "all") {
      urgencyMatches = item.status !== "Fulfilled";
    }

    return searchMatches && accountMatches && urgencyMatches;
  });

  const handleToggleStatus = (id: string, newStatus: CommitmentStatus, note?: string) => {
    setCommitments((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const isFulfilled = newStatus === "Fulfilled";
          return {
            ...c,
            status: newStatus,
            urgency: isFulfilled ? "completed" : c.urgency,
            fulfilledAt: isFulfilled
              ? "Today at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : undefined,
            fulfillmentNote: isFulfilled
              ? note || `Marked fulfilled by Alex Miller (Outside AM). Customer informed.`
              : undefined
          };
        }
        return c;
      })
    );

    const target = commitments.find((c) => c.id === id);
    if (newStatus === "Fulfilled") {
      setSuccessToast(`✓ Promise kept for ${target?.accountName}: "${target?.title}".`);
    } else {
      setSuccessToast(`Promise reopened for ${target?.accountName} and returned to active queue.`);
    }
  };

  const handleQuickAction = (item: CommitmentItem) => {
    if (!item.quickAction) return;
    // Simulate action completion
    setCommitments((prev) =>
      prev.map((c) => {
        if (c.id === item.id) {
          return {
            ...c,
            status: "Fulfilled",
            urgency: "completed",
            fulfilledAt: "Today at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            fulfillmentNote: item.quickAction!.confirmToast.replace("✓ ", "")
          };
        }
        return c;
      })
    );
    setSuccessToast(item.quickAction.confirmToast);
  };

  const handleReschedule = (id: string, newDate: string, reason: string) => {
    setCommitments((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            dueDate: newDate,
            urgency: newDate.toLowerCase().includes("today") ? "today" : "this_week",
            status: "In Progress",
            details: c.details ? `${c.details} (Rescheduled: ${reason})` : `Rescheduled: ${reason}`
          };
        }
        return c;
      })
    );
    const target = commitments.find((c) => c.id === id);
    setSuccessToast(`Deadline rescheduled for ${target?.accountName} to ${newDate}.`);
  };

  const handleCreateCommitment = (newCommitment: CommitmentItem) => {
    setCommitments((prev) => [newCommitment, ...prev]);
    setSuccessToast(`✓ New promise captured for ${newCommitment.accountName}: "${newCommitment.title}".`);
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={<span className="eyebrow">REPMOTION · TERRITORY PROMISE KEEPER</span>}
        title="Commitments"
        subtitle="Track, fulfill, and safeguard every customer promise across your White Cap territory. Every promise in view."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Icon name="refresh-cw" size="sm" />}
              onClick={demo.refresh}
            >
              Refresh Signals
            </Button>
            <Button
              onClick={() => setIsNewModalOpen(true)}
              leftIcon={<Icon name="plus" size="sm" />}
            >
              + Capture Commitment
            </Button>
          </div>
        }
      />

      {/* Top Territory Metrics */}
      <Metrics
        items={[
          ["Active Commitments", `${activeCommitments.length} Active Promises`, `${todayCommitments.length} Due Today · ${overdueCommitments.length} Overdue`],
          ["Fulfillment Reliability", "94.2%", "On-time completion rate (White Cap territory)"],
          ["Pending Dependencies", `${dependenciesCount} Cross-Functional`, "Awaiting DC stock count, spec stamp, or carrier ETA"],
          [
            "Next Due Deadline",
            todayCommitments[0] ? todayCommitments[0].accountName.split(" ")[0] : "All Today Cleared",
            todayCommitments[0] ? todayCommitments[0].dueDate : "No urgent deadlines"
          ]
        ]}
      />

      {/* ── Focus-3 Spotlight ─────────────────────────────────────────────── */}
      {focus3Commitments.length > 0 && (
        <section className="rounded-xl border-2 border-amber-400/50 bg-amber-500/5 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Icon name="zap" size="xs" />
            </div>
            <div>
              <strong className="text-sm text-foreground">Focus-3 — Handle Before You Hit the Field</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                These {focus3Commitments.length} promises need 1-click action right now. Your customers are waiting.
              </p>
            </div>
            <Badge variant="warning" className="ml-auto">
              {focus3Commitments.length} Urgent
            </Badge>
          </div>

          <div className="space-y-3">
            {focus3Commitments.map((item) => (
              <CommitmentCard
                key={item.id}
                item={item}
                onToggleStatus={handleToggleStatus}
                onReschedule={(target) => setSelectedForReschedule(target)}
                onQuickAction={handleQuickAction}
                isSpotlight={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* Insight Strip */}
      <div className="insight-strip">
        <span className="icon-tile">
          <Icon name="sparkles" size="md" />
        </span>
        <div className="grow">
          <strong>Territory Promise Engine Active</strong>
          <p>
            Customer commitments are shared in real time across Outside Sales, Inside Sales, and Customer Care.
            Fulfilling technical submittals and delivery updates on time protects account retention and drives reorder confidence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            Updated {demo.refreshTime || "8:06 AM"}
          </Badge>
          <Badge variant="primary">{activeCommitments.length} Active</Badge>
          {fulfilledCommitments.length > 0 && (
            <Badge variant="success">✓ {fulfilledCommitments.length} Fulfilled</Badge>
          )}
        </div>
      </div>

      {/* Action Notification Toast */}
      {successToast && (
        <div className="p-3.5 rounded-lg bg-emerald-50 text-emerald-900 text-sm flex items-center justify-between border border-emerald-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </span>
            <span className="font-medium">{successToast}</span>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline ml-3 shrink-0"
            onClick={() => setSuccessToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="content-grid">
        {/* Left Column: Full Commitments Queue */}
        <Panel
          title={filterState.urgencyFilter === "completed" ? "Fulfilled Customer Promises" : "Full Territory Commitment Queue"}
          description={
            filterState.urgencyFilter === "completed"
              ? "Completed customer promises and delivery verifications"
              : "All active deadlines, technical submittals, and stock verifications"
          }
          action={
            <div className="text-xs text-muted-foreground font-medium">
              Showing {visibleCommitments.length} of {commitments.length} commitments
            </div>
          }
        >
          {/* Filters Bar */}
          <CommitmentFilters
            filterState={filterState}
            onFilterChange={setFilterState}
            items={commitments}
          />

          {/* Commitment Cards List */}
          <div className="space-y-4">
            {visibleCommitments.map((item) => (
              <CommitmentCard
                key={item.id}
                item={item}
                onToggleStatus={handleToggleStatus}
                onReschedule={(target) => setSelectedForReschedule(target)}
                onQuickAction={handleQuickAction}
                isSpotlight={focus3Ids.has(item.id)}
              />
            ))}

            {visibleCommitments.length === 0 && (
              <div className="empty-state p-10 text-center border-2 border-dashed border-border rounded-xl">
                <Icon name="check-circle" size="xl" className="mx-auto text-emerald-500 mb-3 opacity-80" />
                <h3 className="text-base font-bold text-foreground">
                  {filterState.urgencyFilter === "completed"
                    ? "No fulfilled promises in this view"
                    : "No active commitments match this filter"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Try adjusting your search criteria or switch to view all active promises.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setFilterState({
                      searchQuery: "",
                      urgencyFilter: "all",
                      statusFilter: "all",
                      accountFilter: "all",
                      ownerFilter: "all"
                    })
                  }
                >
                  Reset Active Filters
                </Button>
              </div>
            )}
          </div>
        </Panel>

        {/* Right Column: Governance & SLA Highlights */}
        <aside className="page-stack">
          {/* Urgent Overdue Callout Card */}
          {overdueCommitments.length > 0 && (
            <section className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-wider">
                <Icon name="alert-triangle" size="xs" />
                <span>OVERDUE RISK ALERT</span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {overdueCommitments[0].accountName}
              </h3>
              <p className="text-xs text-foreground/80 leading-relaxed">
                "{overdueCommitments[0].title}" passed its deadline. Contact {overdueCommitments[0].contact.name} at {overdueCommitments[0].contact.phone} immediately.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs w-full"
                  onClick={() => setSelectedForReschedule(overdueCommitments[0])}
                >
                  Reschedule with Customer
                </Button>
              </div>
            </section>
          )}

          {/* The Promise Principle */}
          <Panel title="The Promise Principle" description="Why commitments drive commercial growth">
            <div className="space-y-3 text-xs text-foreground/85">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[11px]">01</div>
                <div>
                  <strong className="block text-foreground">Zero Dropped Balls</strong>
                  <p className="text-muted-foreground text-[11px]">82% of B2B buyers switch distributors due to unfulfilled follow-through, not price.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[11px]">02</div>
                <div>
                  <strong className="block text-foreground">Cross-Department Visibility</strong>
                  <p className="text-muted-foreground text-[11px]">When a field rep promises a sample, Customer Care and Inside Sales see the dependency instantly.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[11px]">03</div>
                <div>
                  <strong className="block text-foreground">Pre-Call Context</strong>
                  <p className="text-muted-foreground text-[11px]">Every active commitment automatically surfaces in the rep's 3-minute jobsite meeting brief.</p>
                </div>
              </div>
            </div>
          </Panel>

          {/* White Cap Account Quick-Jump */}
          <Panel title="White Cap Account Quick-Jump" description="Review promises by customer">
            <div className="space-y-2 text-xs">
              {[
                { name: "Oak Ridge Concrete", id: "oakridge", count: 2 },
                { name: "Summit Commercial Builders", id: "summit", count: 2 },
                { name: "Lakeside Steel Fabricators", id: "lakeside", count: 1 },
                { name: "Apex Framing Contractors", id: "apex", count: 2 },
                { name: "Metro Foundations", id: "metro", count: 1 },
                { name: "NorthStar Logistics Hubs", id: "northstar", count: 1 },
                { name: "Cedar Valley Components", id: "cedar", count: 1 }
              ].map((acc) => {
                const liveCount = commitments.filter(
                  (c) => c.accountId === acc.id && c.status !== "Fulfilled"
                ).length;
                return (
                  <Link
                    key={acc.id}
                    href={`/accounts/${acc.id}`}
                    className="p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 flex items-center justify-between transition-colors group"
                  >
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {acc.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono ${liveCount > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                        {liveCount > 0 ? `${liveCount} Active` : "All Clear"}
                      </span>
                      <Icon name="arrow-right" size="xs" className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </aside>
      </div>

      {/* New Commitment Modal */}
      <NewCommitmentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleCreateCommitment}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        item={selectedForReschedule}
        onClose={() => setSelectedForReschedule(null)}
        onConfirm={handleReschedule}
      />
    </div>
  );
}
