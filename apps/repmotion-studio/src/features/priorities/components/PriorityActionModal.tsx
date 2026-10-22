"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Icon,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from "@/components/ui";
import type { PriorityItem } from "../types";

interface PriorityActionModalProps {
  item: PriorityItem | null;
  onClose: () => void;
  onActionComplete: (message: string, itemId: string) => void;
  onToggleComplete?: (itemId: string) => void;
}

export function PriorityActionModal({
  item,
  onClose,
  onActionComplete,
  onToggleComplete
}: PriorityActionModalProps) {
  const [successNote, setSuccessNote] = useState<string | null>(null);

  if (!item) return null;

  const handleAction = (note: string) => {
    setSuccessNote(note);
    onActionComplete(note, item.id);
  };

  return (
    <Modal isOpen={!!item} onClose={onClose} size="lg">
      <ModalHeader
        title={item.accountName}
        subtitle={`${item.categoryLabel} · ${item.urgencyLabel}`}
        onClose={onClose}
      />
      <ModalBody>
        <div className="space-y-4">
          {/* Header pill strip */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="primary">
                {item.categoryLabel}
              </Badge>
              <Badge variant={item.readiness === "ready" ? "success" : item.readiness === "review" ? "warning" : "error"} dot>
                {item.readiness === "ready" ? "Action Ready" : item.readiness === "review" ? "Review Required" : "Outreach on Hold"}
              </Badge>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {item.accountTier} Tier · {item.annualSpend}
              </span>
            </div>
            <div className="text-right">
              <strong className="text-sm font-bold block">{item.potentialValue}</strong>
              <span className="text-xs text-muted-foreground">{item.urgencyLabel}</span>
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-foreground">{item.title}</h3>
            <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{item.description}</p>
          </div>

          {/* Decision Maker Contact Card */}
          <div className="bg-muted/40 p-3.5 rounded-lg border border-border flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                {item.primaryContact.avatarInitials}
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Primary Decision Maker
                </span>
                <strong className="text-sm text-foreground">{item.primaryContact.name}</strong>
                <span className="text-xs text-muted-foreground block">{item.primaryContact.role}</span>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-mono text-foreground font-medium">{item.primaryContact.phone}</div>
              <div className="text-muted-foreground">{item.primaryContact.email}</div>
            </div>
          </div>

          {/* CASE 1: Meeting Prep Context */}
          {item.meetingDetails && (
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Icon name="calendar-days" size="xs" />
                  Meeting Blueprint
                </span>
                <span className="text-xs font-medium text-foreground">{item.meetingDetails.time}</span>
              </div>
              <p className="text-xs text-muted-foreground">Location: <strong>{item.meetingDetails.location}</strong></p>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold block text-foreground">Planned Meeting Agenda:</span>
                {item.meetingDetails.agenda.map((agendaItem, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-foreground/85">
                    <span className="w-4 h-4 rounded bg-muted text-muted-foreground flex items-center justify-center shrink-0 text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span>{agendaItem}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CASE 2: Quote Unblocked Line Items */}
          {item.unblockedQuote && (
            <div className="space-y-3 border border-border rounded-lg p-3.5 bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-sm block">Quote {item.unblockedQuote.quoteNumber} · Inventory Restocked</strong>
                  <span className="text-xs text-muted-foreground">
                    Total Value: ${item.unblockedQuote.totalAmount.toLocaleString()} ({item.unblockedQuote.discountPct}% pre-approved discount)
                  </span>
                </div>
                <Badge variant="success">Ready to Release</Badge>
              </div>

              <div className="text-xs border rounded-md overflow-hidden">
                <div className="bg-muted px-3 py-1.5 font-semibold text-muted-foreground grid grid-cols-12 gap-2">
                  <span className="col-span-5">Restocked Product</span>
                  <span className="col-span-2">Required Qty</span>
                  <span className="col-span-3">Branch Stock</span>
                  <span className="col-span-2 text-right">Subtotal</span>
                </div>
                {item.unblockedQuote.unblockedItems.map((line) => (
                  <div key={line.sku} className="px-3 py-2 border-t grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <strong className="block text-foreground">{line.name}</strong>
                      <span className="text-muted-foreground font-mono text-[10px]">{line.sku}</span>
                    </div>
                    <span className="col-span-2">{line.quantity} units</span>
                    <div className="col-span-3">
                      <span className="text-emerald-700 font-semibold block">{line.stockAvailable} units in stock</span>
                      <span className="text-muted-foreground text-[10px]">{line.branchLocation}</span>
                    </div>
                    <span className="col-span-2 text-right font-medium">
                      ${(line.quantity * line.unitPrice).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handleAction(`Quote ${item.unblockedQuote?.quoteNumber} sent directly to ${item.primaryContact.name} (${item.primaryContact.email})`)}
                  leftIcon={<Icon name="send" size="xs" />}
                >
                  Release & Email Quote to Buyer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleAction(`Follow-up call logged with ${item.primaryContact.name}`)}
                  leftIcon={<Icon name="phone" size="xs" />}
                >
                  Call Marcus
                </Button>
              </div>
            </div>
          )}

          {/* CASE 3: Active Service Hold */}
          {item.serviceEscalation && (
            <div className="p-4 rounded-lg border-2 border-destructive/30 bg-destructive/5 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                <Icon name="shield-alert" size="sm" />
                <span>OUTBOUND SALES OUTREACH ON HOLD (GOVERNANCE POLICY)</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">
                <strong>Policy Mandate:</strong> {item.serviceEscalation.policyMessage}
              </p>
              <div className="bg-card p-3 rounded-md border border-border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Case Number:</span>
                  <strong className="font-mono">{item.serviceEscalation.caseNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned Care Specialist:</span>
                  <strong>{item.serviceEscalation.assignedSpecialist}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subject:</span>
                  <span className="font-medium">{item.serviceEscalation.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-amber-600 font-semibold">{item.serviceEscalation.status}</span>
                </div>
                <div className="pt-1.5 text-muted-foreground border-t border-border mt-1">
                  <strong>Latest Care Note:</strong> {item.serviceEscalation.resolutionNote}
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Link
                  href="/service"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Icon name="headset" size="xs" />
                  Open Customer Care Queue
                </Link>
                <span className="text-xs text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => handleAction(`Notified care specialist Ava Brooks that sales rep is aware of Case ${item.serviceEscalation?.caseNumber}`)}
                  className="text-xs text-foreground/80 hover:text-foreground underline"
                >
                  Notify Ava Brooks
                </button>
              </div>
            </div>
          )}

          {/* CASE 4: Customer Promise Due */}
          {item.promiseContext && (
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <Icon name="clock-3" size="xs" />
                  Promise Due Today
                </span>
                <span className="text-xs font-bold text-amber-700">{item.promiseContext.dueTime}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{item.promiseContext.promiseTitle}</p>
              <div className="text-xs bg-muted/40 p-2.5 rounded border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Fulfillment Dependency</span>
                <span className="text-foreground">{item.promiseContext.dependency}</span>
              </div>
              <Button
                size="sm"
                onClick={() => handleAction(`Delivery confirmation sent to ${item.primaryContact.name}. Promise marked as fulfilled.`)}
                leftIcon={<Icon name="check" size="xs" />}
              >
                Send Carrier Confirmation to Elena
              </Button>
            </div>
          )}

          {/* CASE 5: Replenishment Cadence */}
          {item.reorderCadence && (
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Replenishment Cadence Metrics
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-muted/40 border border-border">
                  <span className="text-muted-foreground block text-[10px]">Typical Cycle</span>
                  <strong className="text-sm">{item.reorderCadence.typicalCycleDays} Days</strong>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border">
                  <span className="text-muted-foreground block text-[10px]">Elapsed Days</span>
                  <strong className="text-sm text-primary">{item.reorderCadence.daysSinceLastOrder} Days</strong>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border">
                  <span className="text-muted-foreground block text-[10px]">Warehouse Lead Time</span>
                  <strong className="text-sm">{item.reorderCadence.leadTimeDays} Days</strong>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleAction(`Draft replenishment email generated for ${item.primaryContact.name} with standard consumable SKUs.`)}
                leftIcon={<Icon name="mail" size="xs" />}
              >
                Draft Replenishment Check-in Email
              </Button>
            </div>
          )}

          {/* Success Banner */}
          {successNote && (
            <div className="p-3 rounded-md bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
              <Icon name="check" size="sm" />
              <span>{successNote}</span>
            </div>
          )}

          {/* Evidence Checklist */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Evidence Attached to this Priority
            </span>
            <div className="space-y-1">
              {item.evidence.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                  <Icon name="check" size="xs" className="text-primary shrink-0" />
                  <span>{ev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center justify-between w-full">
          <div>
            {onToggleComplete && (
              <Button
                variant={item.completed ? "secondary" : "secondary"}
                className={item.completed ? "text-amber-700" : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"}
                onClick={() => {
                  onToggleComplete(item.id);
                  if (!item.completed) {
                    setSuccessNote(`Marked priority for ${item.accountName} as completed.`);
                  }
                }}
                leftIcon={<Icon name={item.completed ? "rotate-ccw" : "check-circle"} size="xs" />}
              >
                {item.completed ? "Reopen Priority" : "Mark Done ✓"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Link
              href={`/accounts/${item.accountId}`}
              className="inline-flex items-center justify-center gap-2 min-h-[36px] px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Open Account 360 & Brief
              <Icon name="arrow-right" size="xs" />
            </Link>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
