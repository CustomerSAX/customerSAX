"use client";

import { Icon, Input } from "@/components/ui";
import { accountsDirectory } from "../../accounts/data";
import type { CommitmentFilterState, CommitmentItem } from "../types";

interface CommitmentFiltersProps {
  filterState: CommitmentFilterState;
  onFilterChange: (newState: CommitmentFilterState) => void;
  items: CommitmentItem[];
}

export function CommitmentFilters({
  filterState,
  onFilterChange,
  items
}: CommitmentFiltersProps) {
  const activeCount = items.filter((i) => i.status !== "Fulfilled").length;
  const overdueCount = items.filter((i) => i.status === "Overdue" || i.urgency === "overdue").length;
  const todayCount = items.filter((i) => i.urgency === "today" && i.status !== "Fulfilled").length;
  const thisWeekCount = items.filter((i) => i.urgency === "this_week" && i.status !== "Fulfilled").length;
  const fulfilledCount = items.filter((i) => i.status === "Fulfilled").length;

  const accounts = Object.values(accountsDirectory);

  return (
    <div className="space-y-3.5 mb-5">
      {/* Top Level: Urgency & Lifecycle Pill Group */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: "Active Commitments", count: activeCount, color: "primary" },
            { id: "today", label: "Due Today", count: todayCount, color: "warning" },
            { id: "overdue", label: "Overdue Risk", count: overdueCount, color: "error" },
            { id: "this_week", label: "This Week", count: thisWeekCount, color: "neutral" },
            { id: "completed", label: "Fulfilled ✓", count: fulfilledCount, color: "success" }
          ].map((tab) => {
            const active = filterState.urgencyFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  active
                    ? tab.id === "completed"
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : tab.id === "overdue"
                      ? "bg-destructive text-destructive-foreground font-semibold shadow-sm"
                      : "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() =>
                  onFilterChange({
                    ...filterState,
                    urgencyFilter: tab.id as CommitmentFilterState["urgencyFilter"]
                  })
                }
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-card text-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-muted-foreground font-medium">
          {overdueCount > 0 ? (
            <span className="text-destructive font-semibold flex items-center gap-1">
              <Icon name="alert-triangle" size="xs" />
              {overdueCount} promise requires immediate customer outreach
            </span>
          ) : (
            "All promises on track"
          )}
        </span>
      </div>

      {/* Search and Secondary Account Filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="w-full sm:w-80">
          <Input
            aria-label="Search commitments"
            placeholder="Search promise, customer, contact, or dependency..."
            value={filterState.searchQuery}
            onChange={(e) =>
              onFilterChange({ ...filterState, searchQuery: e.target.value })
            }
            leftIcon={<Icon name="search" size="sm" />}
          />
        </div>

        {/* Account Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Icon name="building-2" size="xs" />
            <span>Account:</span>
            <select
              className="bg-card border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              value={filterState.accountFilter}
              onChange={(e) =>
                onFilterChange({ ...filterState, accountFilter: e.target.value })
              }
            >
              <option value="all">All Accounts ({items.length})</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </label>

          {/* Reset Filters */}
          {(filterState.searchQuery ||
            filterState.urgencyFilter !== "all" ||
            filterState.accountFilter !== "all") && (
            <button
              type="button"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium ml-2"
              onClick={() =>
                onFilterChange({
                  searchQuery: "",
                  urgencyFilter: "all",
                  statusFilter: "all",
                  accountFilter: "all",
                  ownerFilter: "all"
                })
              }
            >
              <Icon name="x" size="xs" />
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
