"use client";

import { Icon, Input } from "@/components/ui";
import type { PriorityCategory, PriorityFilterState, PriorityItem, PriorityReadiness, PriorityUrgency } from "../types";

interface PriorityFiltersProps {
  filterState: PriorityFilterState;
  onFilterChange: (newState: PriorityFilterState) => void;
  items: PriorityItem[];
}

export function PriorityFilters({
  filterState,
  onFilterChange,
  items
}: PriorityFiltersProps) {
  const activeItems = items.filter((i) => !i.completed);
  const completedItems = items.filter((i) => i.completed);

  const contextItems =
    filterState.statusFilter === "completed"
      ? completedItems
      : filterState.statusFilter === "all"
      ? items
      : activeItems;

  const getReadinessCount = (readiness: "all" | PriorityReadiness) => {
    if (readiness === "all") return contextItems.length;
    return contextItems.filter((item) => item.readiness === readiness).length;
  };

  const getUrgencyCount = (urgency: "all" | PriorityUrgency) => {
    if (urgency === "all") return contextItems.length;
    return contextItems.filter((item) => item.urgency === urgency).length;
  };

  return (
    <div className="space-y-3.5 mb-5">
      {/* Top Level: Queue Status (Active vs Completed) */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterState.statusFilter === "active"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onFilterChange({ ...filterState, statusFilter: "active" })}
          >
            <Icon name="layout-dashboard" size="xs" />
            <span>Active Action Queue</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterState.statusFilter === "active" ? "bg-white/20 text-white" : "bg-card text-foreground"}`}>
              {activeItems.length}
            </span>
          </button>

          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterState.statusFilter === "completed"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onFilterChange({ ...filterState, statusFilter: "completed" })}
          >
            <Icon name="check" size="xs" />
            <span>Completed Today</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterState.statusFilter === "completed" ? "bg-white/20 text-white" : "bg-card text-foreground"}`}>
              {completedItems.length}
            </span>
          </button>
        </div>

        <span className="text-xs text-muted-foreground">
          {filterState.statusFilter === "completed"
            ? `${completedItems.length} priorities resolved today`
            : `${activeItems.length} priorities awaiting your action`}
        </span>
      </div>

      {/* Search and Urgency Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="w-full sm:w-80">
          <Input
            aria-label="Search priorities"
            placeholder="Search accounts, triggers, or contacts..."
            value={filterState.searchQuery}
            onChange={(e) =>
              onFilterChange({ ...filterState, searchQuery: e.target.value })
            }
            leftIcon={<Icon name="search" size="sm" />}
          />
        </div>

        {/* Urgency Pill Group */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border text-xs" role="group" aria-label="Filter by urgency">
          {[
            { id: "all", label: "All Items" },
            { id: "today", label: "Due Today" },
            { id: "this_week", label: "This Week" }
          ].map((tab) => {
            const count = getUrgencyCount(tab.id as "all" | PriorityUrgency);
            const active = filterState.urgencyFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  active
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() =>
                  onFilterChange({
                    ...filterState,
                    urgencyFilter: tab.id as "all" | PriorityUrgency
                  })
                }
              >
                <span>{tab.label}</span>
                <span className={`ml-1 text-[11px] ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Readiness Secondary Filter Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground font-medium mr-1">Status:</span>
          {[
            { id: "all", label: "All" },
            { id: "ready", label: "Action Ready" },
            { id: "review", label: "Needs Review" },
            { id: "blocked", label: "Outreach on Hold" }
          ].map((filter) => {
            const count = getReadinessCount(filter.id as "all" | PriorityReadiness);
            const active = filterState.readinessFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground/80 border-border hover:bg-muted"
                }`}
                onClick={() =>
                  onFilterChange({
                    ...filterState,
                    readinessFilter: filter.id as "all" | PriorityReadiness
                  })
                }
              >
                <span>{filter.label}</span>
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Clear Filters if active */}
        {(filterState.searchQuery ||
          filterState.urgencyFilter !== "all" ||
          filterState.readinessFilter !== "all" ||
          filterState.categoryFilter !== "all") && (
          <button
            type="button"
            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            onClick={() =>
              onFilterChange({
                searchQuery: "",
                urgencyFilter: "all",
                categoryFilter: "all",
                readinessFilter: "all",
                statusFilter: filterState.statusFilter
              })
            }
          >
            <Icon name="x" size="xs" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}
