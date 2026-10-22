"use client";

import { useState } from "react";
import {
  Button,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader
} from "@/components/ui";
import type { EnrichedQuote } from "../data";

interface MarginExceptionModalProps {
  quote: EnrichedQuote | null;
  onClose: () => void;
  onSubmit: (quoteId: string, requestedDiscount: number, reason: string) => void;
}

export function MarginExceptionModal({ quote, onClose, onSubmit }: MarginExceptionModalProps) {
  const [discountPct, setDiscountPct] = useState(12);
  const [reason, setReason] = useState("Customer requested 12% discount to match competitive quote from industrial distributor.");
  const [expectedCloseDate, setExpectedCloseDate] = useState("By Friday, Oct 24");

  if (!quote) return null;

  const currentTotal = quote.subtotal * (1 - discountPct / 100);
  const estimatedMarginPct = (quote.marginPct - (discountPct - quote.discountPct) * 0.8).toFixed(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(quote.id, discountPct, reason);
    onClose();
  };

  return (
    <Modal isOpen={!!quote} onClose={onClose} size="lg">
      <ModalHeader
        title={`Request Margin Discount Override (${quote.quoteNumber})`}
        subtitle={`${quote.accountName} · Standard discount cap is 10.0%`}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4 text-xs">
            {/* Commercial Context Card */}
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Quote Subtotal
                </span>
                <strong className="text-sm font-mono text-foreground">${quote.subtotal.toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Current Discount
                </span>
                <strong className="text-sm text-foreground">{quote.discountPct}%</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Target Margin
                </span>
                <strong className="text-sm text-emerald-700">{quote.targetMarginPct}% Floor</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Projected Margin
                </span>
                <strong className={`text-sm ${Number(estimatedMarginPct) < quote.targetMarginPct ? "text-amber-700" : "text-emerald-700"}`}>
                  {estimatedMarginPct}%
                </strong>
              </div>
            </div>

            {/* Requested Discount Slider / Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Requested Discount Percentage</span>
                <span className="font-bold text-sm text-primary">{discountPct}% Discount</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                step="0.5"
                value={discountPct}
                onChange={(e) => setDiscountPct(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Standard (5%)</span>
                <span>Manager Signoff Trigger (&gt;10%)</span>
                <span>VP Approval (&gt;20%)</span>
              </div>
            </div>

            {/* Revised Total Display */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                  Resulting Proposal Value:
                </span>
                <strong className="text-base text-foreground font-bold">
                  ${Math.round(currentTotal).toLocaleString()}
                </strong>
              </div>
              <div className="text-right text-xs">
                <span className="text-muted-foreground block">Variance vs Standard:</span>
                <strong className="text-destructive font-mono">
                  -${Math.round(quote.subtotal * (discountPct / 100) - quote.subtotal * (quote.discountPct / 100)).toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Reason / Justification */}
            <label className="block space-y-1">
              <span className="font-semibold text-foreground">Business Rationale / Competitive Intel *</span>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Competitor matched at $52K; customer commits to full Q4 exclusivity"
                required
              />
            </label>

            {/* Expected Close Date */}
            <label className="block space-y-1">
              <span className="font-semibold text-foreground">Expected Close Date Upon Approval</span>
              <Input
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                placeholder="e.g. End of Month"
                required
              />
            </label>

            <div className="p-2.5 rounded-lg bg-muted border border-border text-[11px] text-muted-foreground">
              <strong className="text-foreground">Policy Rule:</strong> Discounts exceeding 10.0% require electronic signoff from the Branch Sales Manager before the quote can be executed in ERP.
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit">
            Submit Request to Sales Manager
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
