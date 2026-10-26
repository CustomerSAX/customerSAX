"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Icon } from "@/components/ui";
import type { EnrichedQuote } from "../data";

interface QuoteCardProps {
  quote: EnrichedQuote;
  onSendLink: (quote: EnrichedQuote) => void;
  onRequestException: (quote: EnrichedQuote) => void;
  onManagerApprove: (quoteId: string, approvedDiscountPct: number) => void;
  onExtendValidity: (quoteId: string) => void;
}

export function QuoteCard({
  quote,
  onSendLink,
  onRequestException,
  onManagerApprove,
  onExtendValidity
}: QuoteCardProps) {
  const [showLineItems, setShowLineItems] = useState(false);

  const isPendingApproval = quote.approvalStatus === "Pending Manager Approval";
  const isConverted = quote.status === "Converted";
  const isExpiringSoon = quote.daysUntilExpiration <= 2 && quote.daysUntilExpiration > 0;
  const isMarginHealthy = quote.marginPct >= quote.targetMarginPct;

  const getStatusBadge = () => {
    if (isConverted) {
      return <Badge variant="success" dot>Converted to ERP Order</Badge>;
    }
    if (isPendingApproval) {
      return <Badge variant="warning" dot>Pending Manager Signoff</Badge>;
    }
    if (quote.status === "Submitted") {
      return <Badge variant="primary" dot>Out for Buyer Signature</Badge>;
    }
    if (quote.status === "In Review") {
      return <Badge variant="primary" dot>Negotiation / In Review</Badge>;
    }
    return <Badge variant="neutral">Draft Proposal</Badge>;
  };

  return (
    <div
      className={`flex flex-col w-full rounded-xl p-5 border transition-all duration-200 text-left bg-card ${
        isPendingApproval
          ? "border-amber-400/80 shadow-sm"
          : isConverted
          ? "border-emerald-300 shadow-sm opacity-90"
          : isExpiringSoon
          ? "border-destructive/40 shadow-sm"
          : "border-border hover:border-primary/50 hover:shadow-md"
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-foreground bg-muted px-2.5 py-0.5 rounded">
              {quote.quoteNumber}
            </span>
            {getStatusBadge()}
            {isExpiringSoon && (
              <Badge variant="error" dot>Expiring in {quote.daysUntilExpiration} Days</Badge>
            )}
            {quote.unblockedReason && (
              <Badge variant="success">
                <Icon name="boxes" size="xs" />
                <span className="ml-1">Stock Unblocked</span>
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Link
              href={`/accounts/${quote.accountId}`}
              className="font-bold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <span>{quote.accountName}</span>
              <Icon name="arrow-up-right" size="xs" />
            </Link>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground font-medium">{quote.industry}</span>
          </div>
        </div>

        {/* Commercial Figures */}
        <div className="text-right shrink-0">
          <strong className="text-xl font-bold text-foreground block">
            ${quote.negotiatedTotal.toLocaleString()}
          </strong>
          <div className="flex items-center justify-end gap-1.5 text-xs">
            <span className="text-muted-foreground line-through">
              ${quote.subtotal.toLocaleString()}
            </span>
            <span className="font-semibold text-primary">
              ({quote.discountPct}% off)
            </span>
            <span>·</span>
            <span
              className={`font-semibold ${
                isMarginHealthy ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {quote.marginPct}% Margin
            </span>
          </div>
        </div>
      </div>

      {/* Unblocked Stock Callout */}
      {quote.unblockedReason && (
        <div className="my-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
          <Icon name="check-circle" size="xs" className="text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Inventory Restocked:</strong> {quote.unblockedReason}. Ready to release and book.
          </span>
        </div>
      )}

      {/* Pending Manager Approval Callout */}
      {isPendingApproval && quote.approvalRequest && (
        <div className="my-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Icon name="shield-alert" size="xs" />
              Manager Discount Approval Requested ({quote.approvalRequest.requestedDiscountPct}%)
            </span>
            <span className="font-mono text-[11px]">{quote.approvalRequest.requestedAt}</span>
          </div>
          <p className="text-foreground/80 leading-relaxed m-0">
            <strong>Sales Justification:</strong> "{quote.approvalRequest.reason}"
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
              onClick={() => onManagerApprove(quote.id, quote.approvalRequest!.requestedDiscountPct)}
              leftIcon={<Icon name="check" size="xs" />}
            >
              Simulate Manager Fast-Approve (12%)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-7 px-3 text-amber-800 border-amber-300 hover:bg-amber-100"
              onClick={() => onManagerApprove(quote.id, 10)}
            >
              Counter-Offer 10%
            </Button>
          </div>
        </div>
      )}

      {/* Line Items Drawer Toggle */}
      <div className="mt-2 mb-1">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium"
          onClick={() => setShowLineItems(!showLineItems)}
        >
          <Icon name={showLineItems ? "chevron-up" : "chevron-down"} size="xs" />
          <span>
            {showLineItems ? "Hide Line Items" : `View Line Items (${quote.lineItems.length} Products)`}
          </span>
        </button>

        {showLineItems && (
          <div className="mt-2 border border-border rounded-lg overflow-hidden text-xs">
            <div className="bg-muted px-3 py-1.5 font-semibold text-muted-foreground grid grid-cols-12 gap-2">
              <span className="col-span-6">SKU & Item Name</span>
              <span className="col-span-2">Quantity</span>
              <span className="col-span-2">Unit Price</span>
              <span className="col-span-2 text-right">Subtotal</span>
            </div>
            {quote.lineItems.map((item) => (
              <div key={item.id} className="px-3 py-2 border-t grid grid-cols-12 gap-2 items-center bg-card">
                <div className="col-span-6">
                  <span className="font-semibold text-foreground block">{item.name}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{item.sku}</span>
                    <span>·</span>
                    <span className="text-emerald-600 font-medium">{item.availableBranch}</span>
                  </div>
                </div>
                <span className="col-span-2 font-medium">{item.quantity}</span>
                <span className="col-span-2">${item.negotiatedPrice.toLocaleString()}</span>
                <span className="col-span-2 text-right font-bold text-foreground">
                  ${item.subtotal.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Decision Maker & Quick Actions */}
      <div className="pt-3 mt-2 border-t border-border flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
            {quote.primaryContact.avatarInitials}
          </div>
          <div>
            <span className="font-semibold text-foreground">{quote.primaryContact.name}</span>
            <span className="text-muted-foreground ml-1.5">({quote.primaryContact.role})</span>
          </div>
          <span className="text-muted-foreground text-[11px] ml-2">
            Valid until: <strong>{quote.validUntil}</strong>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isExpiringSoon && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onExtendValidity(quote.id)}
              leftIcon={<Icon name="calendar-plus" size="xs" />}
            >
              Extend +7 Days
            </Button>
          )}

          {!isConverted && !isPendingApproval && (
            <Button
              size="sm"
              variant="secondary"
              className="text-primary border-primary/30 hover:bg-primary/5"
              onClick={() => onRequestException(quote)}
              leftIcon={<Icon name="percent" size="xs" />}
            >
              Request Discount Override
            </Button>
          )}

          {!isConverted && (
            <Button
              size="sm"
              onClick={() => onSendLink(quote)}
              leftIcon={<Icon name="send" size="xs" />}
            >
              Send Direct Accept Link
            </Button>
          )}

          {isConverted && (
            <Badge variant="success">✓ PO Booked in ERP</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
