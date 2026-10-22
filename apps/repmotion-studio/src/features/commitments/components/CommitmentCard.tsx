"use client";

import Link from "next/link";
import { Badge, Button, Icon } from "@/components/ui";
import type { CommitmentItem } from "../types";

interface CommitmentCardProps {
  item: CommitmentItem;
  onToggleStatus: (id: string, newStatus: CommitmentItem["status"], note?: string) => void;
  onReschedule: (item: CommitmentItem) => void;
  onQuickAction?: (item: CommitmentItem) => void;
  isSpotlight?: boolean; // Whether this is one of the top Focus-3 cards
}

export function CommitmentCard({
  item,
  onToggleStatus,
  onReschedule,
  onQuickAction,
  isSpotlight = false
}: CommitmentCardProps) {
  const isFulfilled = item.status === "Fulfilled";
  const isOverdue = item.status === "Overdue";
  const isToday = item.urgency === "today" && !isFulfilled;

  const getUrgencyBadge = () => {
    if (isFulfilled) return <Badge variant="success" dot>Fulfilled ✓</Badge>;
    if (isOverdue) return <Badge variant="error" dot>Overdue — Act Now</Badge>;
    if (isToday) return <Badge variant="warning" dot>Due Today</Badge>;
    return <Badge variant="primary" dot>{item.dueDate}</Badge>;
  };

  const getCategoryIcon = (category: CommitmentItem["category"]) => {
    switch (category) {
      case "submittal_spec": return "file-text";
      case "stock_reservation": return "boxes";
      case "pricing_quote": return "badge-dollar-sign";
      case "logistics_tracking": return "truck";
      case "billing_credit": return "credit-card";
      case "sample_shipment": return "package";
      default: return "sparkles";
    }
  };

  const getBorderClass = () => {
    if (isFulfilled) return "bg-card/75 border-emerald-300 shadow-sm opacity-90";
    if (isOverdue) return "bg-card border-destructive/50 shadow-md ring-1 ring-destructive/20";
    if (isSpotlight) return "bg-card border-amber-400/60 shadow-md ring-1 ring-amber-400/20";
    if (isToday) return "bg-card border-amber-300/50 shadow-sm";
    return "bg-card border-border hover:border-primary/50 hover:shadow-md";
  };

  return (
    <div className={`flex flex-col w-full rounded-xl p-5 border transition-all duration-200 text-left ${getBorderClass()}`}>

      {/* Spotlight Label */}
      {isSpotlight && !isFulfilled && (
        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-2">
          <Icon name="zap" size="xs" />
          <span>Priority Action — Handle Before Field Visit</span>
        </div>
      )}

      {/* Top Row: Meta & Timing */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {getUrgencyBadge()}
            <Badge variant="neutral">
              <Icon name={getCategoryIcon(item.category)} size="xs" />
              <span className="ml-1">{item.categoryLabel}</span>
            </Badge>
            <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
              {item.id}
            </span>
          </div>

          <h3 className="text-base font-bold text-foreground leading-snug">
            {item.title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Link
              href={`/accounts/${item.accountId}`}
              className="font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>{item.accountName}</span>
              <Icon name="arrow-up-right" size="xs" />
            </Link>
            <span>·</span>
            <span>{item.industry}</span>
          </div>
        </div>

        {/* Due / Owner column */}
        <div className="text-right shrink-0">
          <strong className={`text-sm font-bold block ${isOverdue ? "text-destructive" : isFulfilled ? "text-emerald-700" : isToday ? "text-amber-700" : "text-foreground"}`}>
            {item.dueDate}
          </strong>
          <span className="text-xs text-muted-foreground">
            Owner: <strong>{item.ownerName}</strong>
          </span>
        </div>
      </div>

      {/* Details Description */}
      {item.details && (
        <p className="text-sm text-foreground/80 mt-2.5 mb-2 leading-relaxed">
          {item.details}
        </p>
      )}

      {/* Upstream Dependency Callout */}
      {item.dependency && !isFulfilled && (
        <div className="my-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Icon name="clock-3" size="xs" className="shrink-0 mt-0.5" />
          <span>
            <strong>Upstream Dependency:</strong> {item.dependency}
          </span>
        </div>
      )}

      {/* Fulfillment Stamped Note */}
      {isFulfilled && item.fulfillmentNote && (
        <div className="my-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
          <Icon name="check-circle" size="xs" className="shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <strong>Fulfilled ({item.fulfilledAt}):</strong> {item.fulfillmentNote}
          </div>
        </div>
      )}

      {/* Footer: Contact + Actions */}
      <div className="pt-3 mt-2 border-t border-border flex items-center justify-between gap-3 text-xs flex-wrap">
        {/* Contact */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 border border-primary/20">
            {item.contact.avatarInitials}
          </div>
          <div>
            <span className="font-semibold text-foreground block">{item.contact.name}</span>
            <span className="text-muted-foreground text-[11px]">{item.contact.role} · {item.contact.phone}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isFulfilled ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onReschedule(item)}
                leftIcon={<Icon name="calendar-clock" size="xs" />}
              >
                Reschedule
              </Button>

              {/* 1-Click Specific Quick Action */}
              {item.quickAction && onQuickAction ? (
                <Button
                  size="sm"
                  className={`text-white text-xs ${
                    isOverdue
                      ? "bg-destructive hover:bg-destructive/90"
                      : "bg-primary hover:bg-primary/90"
                  }`}
                  onClick={() => onQuickAction(item)}
                  leftIcon={<Icon name={item.quickAction.icon} size="xs" />}
                >
                  {item.quickAction.label}
                </Button>
              ) : null}

              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onToggleStatus(item.id, "Fulfilled")}
                leftIcon={<Icon name="check" size="xs" />}
              >
                Mark Fulfilled ✓
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onToggleStatus(item.id, "Open")}
              leftIcon={<Icon name="rotate-ccw" size="xs" />}
            >
              Reopen Promise
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
