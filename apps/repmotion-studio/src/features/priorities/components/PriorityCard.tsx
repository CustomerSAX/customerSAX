"use client";

import { Badge, Button, Icon } from "@/components/ui";
import type { PriorityItem } from "../types";

interface PriorityCardProps {
  item: PriorityItem;
  rank: number;
  onSelect: (item: PriorityItem) => void;
  onActionClick: (item: PriorityItem, actionType: string) => void;
  onToggleComplete?: (item: PriorityItem) => void;
}

export function PriorityCard({ item, rank, onSelect, onActionClick, onToggleComplete }: PriorityCardProps) {
  const getCategoryVariant = (category: PriorityItem["category"]) => {
    switch (category) {
      case "meeting_prep":
        return "primary";
      case "quote_unblocked":
        return "success";
      case "service_hold":
        return "error";
      case "promise_due":
        return "warning";
      case "reorder_cadence":
        return "neutral";
      case "churn_risk":
        return "error";
      default:
        return "neutral";
    }
  };

  const getCategoryIcon = (category: PriorityItem["category"]) => {
    switch (category) {
      case "meeting_prep":
        return "calendar-days";
      case "quote_unblocked":
        return "boxes";
      case "service_hold":
        return "shield-alert";
      case "promise_due":
        return "clock-3";
      case "reorder_cadence":
        return "refresh-cw";
      case "churn_risk":
        return "trending-down";
      default:
        return "sparkles";
    }
  };

  const getReadinessBadge = (readiness: PriorityItem["readiness"]) => {
    switch (readiness) {
      case "ready":
        return <Badge variant="success" dot>Ready to Action</Badge>;
      case "review":
        return <Badge variant="warning" dot>Needs Review</Badge>;
      case "blocked":
        return <Badge variant="error" dot>Outreach on Hold</Badge>;
    }
  };

  return (
    <div
      className={`flex flex-col w-full text-left rounded-xl p-5 transition-all duration-200 cursor-pointer ${
        item.completed
          ? "bg-card/70 border border-emerald-300 shadow-sm opacity-90"
          : "bg-card border border-border hover:border-primary/50 hover:shadow-md"
      }`}
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item);
        }
      }}
    >
      {/* Top Meta Bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`target-number text-xs font-bold px-2 py-1 rounded-md ${
            item.completed ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
          }`}>
            {item.completed ? "✓" : `0${rank}`}
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {item.completed ? (
                <Badge variant="success" dot>Completed Today</Badge>
              ) : (
                <>
                  <Badge variant={getCategoryVariant(item.category)}>
                    <Icon name={getCategoryIcon(item.category)} size="xs" />
                    <span className="ml-1 font-semibold">{item.categoryLabel}</span>
                  </Badge>
                  {getReadinessBadge(item.readiness)}
                </>
              )}
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted/60 text-muted-foreground">
                {item.accountTier}
              </span>
            </div>
            
            <h3 className="text-base font-bold text-foreground hover:text-primary transition-colors">
              {item.title}
            </h3>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground/90">{item.accountName}</span>
              <span>·</span>
              <span>{item.annualSpend}</span>
            </div>
          </div>
        </div>

        {/* Value and timing right-side column */}
        <div className="text-right shrink-0">
          <strong className="text-sm font-bold text-foreground block">{item.potentialValue}</strong>
          <span className="text-xs font-medium text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
            {item.urgencyLabel}
            <Icon name="arrow-up-right" size="xs" />
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground/80 mt-3 mb-3 leading-relaxed">
        {item.description}
      </p>

      {/* Evidence Chips */}
      <div className="evidence-chips flex flex-wrap gap-1.5 mb-3">
        {item.evidence.map((evidence, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-muted/40 border border-border/60 text-foreground/75"
          >
            <Icon name="check" size="xs" />
            <span>{evidence}</span>
          </span>
        ))}
      </div>

      {/* Decision Maker & Quick Actions Footer */}
      <div className="pt-3 mt-2 border-t border-border flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
            {item.primaryContact.avatarInitials}
          </div>
          <div>
            <span className="font-semibold text-foreground">{item.primaryContact.name}</span>
            <span className="text-muted-foreground ml-1.5">({item.primaryContact.role})</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {item.category === "meeting_prep" && (
            <Button
              size="sm"
              onClick={() => onActionClick(item, "open_brief")}
              leftIcon={<Icon name="calendar-days" size="xs" />}
            >
              Open Meeting Brief
            </Button>
          )}

          {item.category === "quote_unblocked" && (
            <Button
              size="sm"
              onClick={() => onActionClick(item, "release_quote")}
              leftIcon={<Icon name="send" size="xs" />}
            >
              Release Quote (${item.unblockedQuote?.totalAmount.toLocaleString()})
            </Button>
          )}

          {item.category === "service_hold" && (
            <Button
              size="sm"
              variant="secondary"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => onActionClick(item, "inspect_service")}
              leftIcon={<Icon name="shield-alert" size="xs" />}
            >
              Inspect Active Case ({item.serviceEscalation?.caseNumber})
            </Button>
          )}

          {item.category === "promise_due" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onActionClick(item, "fulfill_promise")}
              leftIcon={<Icon name="clock" size="xs" />}
            >
              Confirm Delivery Window
            </Button>
          )}

          {item.category === "reorder_cadence" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onActionClick(item, "check_cadence")}
              leftIcon={<Icon name="refresh-cw" size="xs" />}
            >
              Draft Reorder Check-in
            </Button>
          )}

          {item.category === "churn_risk" && (
            <Button
              size="sm"
              variant="secondary"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => onActionClick(item, "churn_outreach")}
              leftIcon={<Icon name="phone-call" size="xs" />}
            >
              Schedule Recovery Call
            </Button>
          )}

          {onToggleComplete && (
            <Button
              size="sm"
              variant="secondary"
              className={
                item.completed
                  ? "text-amber-700 hover:bg-amber-50 border-border"
                  : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              }
              onClick={() => onToggleComplete(item)}
              leftIcon={<Icon name={item.completed ? "rotate-ccw" : "check"} size="xs" />}
            >
              {item.completed ? "Reopen" : "Done ✓"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
