"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  ModalHeader,
  ModalBody,
  Input,
  EmptyState,
} from "@csa/ui";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { useQuotes } from "../hooks/use-quotes";
import { QuoteStatusChip } from "./QuoteStatusChip";

export function QuoteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { getQuoteById, updateQuoteStatus, addNegotiationTurn } = useQuotes();

  const quote = getQuoteById(id);

  // Perspective switch: Seller (CSA Agent) vs Buyer
  const [rolePerspective, setRolePerspective] = useState<"Seller" | "Buyer">("Seller");

  // Counter proposal / Negotiation state
  const [comment, setComment] = useState("");
  const [offeredSubtotal, setOfferedSubtotal] = useState<number | undefined>(undefined);

  // Decline modal state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  if (!quote) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Quote Not Found"
          actions={
            <Button variant="secondary" onClick={() => router.push("/b2b/quotes")}>
              Back to Quotes
            </Button>
          }
        />
        <EmptyState
          icon="file-text"
          title="Quote Not Found"
          description={`No quote request or offer found with ID or Number: ${id}`}
          action={
            <Button variant="primary" onClick={() => router.push("/b2b/quotes")}>
              Return to Quotes List
            </Button>
          }
        />
      </div>
    );
  }

  const handleApprove = () => {
    updateQuoteStatus(
      quote.id,
      "Approved",
      `${rolePerspective} approved this quote proposal.`,
      rolePerspective
    );
  };

  const handleDecline = () => {
    if (!declineReason.trim()) return;
    updateQuoteStatus(
      quote.id,
      "Declined",
      `Declined: ${declineReason}`,
      rolePerspective
    );
    setShowDeclineModal(false);
    setDeclineReason("");
  };

  const handleSendProposal = () => {
    if (!comment.trim()) return;
    addNegotiationTurn(quote.id, comment, rolePerspective, offeredSubtotal);
    setComment("");
    setOfferedSubtotal(undefined);
  };

  const handleConvertToOrder = () => {
    updateQuoteStatus(
      quote.id,
      "Converted",
      "Quote converted to B2B Order successfully.",
      rolePerspective
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>Quote {quote.quoteNumber}</span>
            <QuoteStatusChip status={quote.status} />
          </div>
        }
        subtitle={`${quote.companyName} • ${quote.customerName} (${quote.customerEmail})`}
        breadcrumbs={
          <div className="flex items-center gap-1 text-xs text-m-text-muted">
            <button onClick={() => router.push("/b2b/quotes")} className="hover:text-m-primary">
              Quotes
            </button>
            <span>/</span>
            <span>{quote.quoteNumber}</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="arrow-left" size="xs" />}
              onClick={() => router.push("/b2b/quotes")}
            >
              Back to Quotes
            </Button>
          </div>
        }
      />

      {/* Role Perspective Switcher & Quote Action Bar */}
      <Panel className="bg-m-surface-1">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-m-text">Active Perspective:</span>
            <div className="flex rounded-m-lg border border-m-border bg-m-surface p-1">
              <button
                type="button"
                onClick={() => setRolePerspective("Seller")}
                className={`px-3 py-1 text-xs font-semibold rounded-m-md transition-colors ${
                  rolePerspective === "Seller"
                    ? "bg-m-primary text-white"
                    : "text-m-text-muted hover:text-m-text"
                }`}
              >
                Seller (Merchant Agent)
              </button>
              <button
                type="button"
                onClick={() => setRolePerspective("Buyer")}
                className={`px-3 py-1 text-xs font-semibold rounded-m-md transition-colors ${
                  rolePerspective === "Buyer"
                    ? "bg-m-primary text-white"
                    : "text-m-text-muted hover:text-m-text"
                }`}
              >
                Buyer (Customer)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {quote.status !== "Approved" && quote.status !== "Converted" && quote.status !== "Declined" && (
              <>
                <Button variant="danger" size="md" onClick={() => setShowDeclineModal(true)}>
                  Decline Quote
                </Button>
                <Button variant="primary" size="md" onClick={handleApprove}>
                  Approve Quote
                </Button>
              </>
            )}

            {quote.status === "Approved" && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Icon name="shopping-bag" size="xs" />}
                onClick={handleConvertToOrder}
              >
                Convert to Order
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Grid: Quote Overview + Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Customer &amp; Company Info">
          <div className="flex flex-col gap-3 p-5 text-sm">
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted">Company Name</span>
              <span className="font-semibold text-m-text">{quote.companyName}</span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted">Company Key</span>
              <span className="font-mono text-xs font-semibold">{quote.companyKey}</span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted">Customer Name</span>
              <span className="font-semibold text-m-text">{quote.customerName}</span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted">Customer Email</span>
              <span className="font-semibold text-m-primary">{quote.customerEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-m-text-muted">PO Number</span>
              <span className="font-mono text-xs text-m-text">{quote.poNumber ?? "--"}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Financial &amp; Validity Summary">
          <div className="flex flex-col gap-3 p-5 text-sm">
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted">Gross Catalog Subtotal</span>
              <span className="font-semibold text-m-text">
                ${quote.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted">Applied Volume Discount</span>
              <span className="font-semibold text-m-success">-{quote.discountPct}%</span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted font-bold">Negotiated Total</span>
              <span className="font-bold text-m-primary text-base">
                ${quote.negotiatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between border-b border-m-border/60 pb-2">
              <span className="text-m-text-muted">Valid Until</span>
              <span className="font-semibold">{formatDate(quote.validUntil)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-m-text-muted">Requested Date</span>
              <span>{formatDateTime(quote.createdAt)}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Quote Line Items */}
      <Panel title={`Quote Line Items (${quote.lineItems.length})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="w-24">Quantity</TableHead>
              <TableHead className="w-32">Catalog Unit ($)</TableHead>
              <TableHead className="w-36">Negotiated Unit ($)</TableHead>
              <TableHead className="w-32 text-right">Subtotal ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quote.lineItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs text-m-text-muted">{item.sku}</TableCell>
                <TableCell className="font-semibold text-m-text">{item.name}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell className="text-m-text-muted">${item.listPrice.toFixed(2)}</TableCell>
                <TableCell className="font-semibold text-m-success">
                  ${item.negotiatedPrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-semibold text-m-text">
                  ${item.subtotal.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* Negotiation History & Counter-Proposal Feed */}
      <Panel title="Negotiation History &amp; Proposal Timeline">
        <div className="flex flex-col gap-4 p-5">
          {/* History Timeline */}
          {quote.negotiationTurns.length === 0 ? (
            <p className="text-xs text-m-text-muted italic py-2">
              No negotiation comments logged yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {quote.negotiationTurns.map((turn) => (
                <div
                  key={turn.id}
                  className={`flex flex-col gap-1 p-3.5 rounded-m-lg border ${
                    turn.authorRole === "Seller"
                      ? "bg-m-primary-50/50 border-m-primary-200"
                      : "bg-m-surface-1 border-m-border"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-m-text">{turn.authorName}</span>
                      <Badge variant={turn.authorRole === "Seller" ? "primary" : "info"} size="sm">
                        {turn.authorRole}
                      </Badge>
                    </div>
                    <span className="text-m-text-muted text-[11px]">
                      {formatDateTime(turn.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-m-text mt-1">{turn.comment}</p>
                  {turn.offeredSubtotal != null && (
                    <span className="text-xs font-semibold text-m-primary mt-1">
                      Counter-Offered Price: ${turn.offeredSubtotal.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New Proposal Input */}
          {quote.status !== "Approved" && quote.status !== "Converted" && quote.status !== "Declined" && (
            <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-m-border">
              <h4 className="text-xs font-semibold text-m-text">
                Post Counter-Proposal / Negotiation Note ({rolePerspective} Perspective)
              </h4>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Type negotiation comment or proposal notes..."
              />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:w-64">
                  <Input
                    type="number"
                    placeholder="Optional new price ($)"
                    value={offeredSubtotal ?? ""}
                    onChange={(e) =>
                      setOfferedSubtotal(e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  disabled={!comment.trim()}
                  onClick={handleSendProposal}
                  leftIcon={<Icon name="send" size="xs" />}
                >
                  Send Counter Proposal
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Decline Modal */}
      {showDeclineModal && (
        <Modal isOpen={showDeclineModal} onClose={() => setShowDeclineModal(false)}>
          <ModalHeader title="Decline Quote Request" onClose={() => setShowDeclineModal(false)} />
          <ModalBody>
            <div className="flex flex-col gap-4 p-2">
              <p className="text-xs text-m-text-muted">
                Please provide a reason for declining this quote request.
              </p>
              <div>
                <label className="text-xs font-semibold text-m-text mb-1 block">Decline Reason</label>
                <Input
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. Requested discount exceeds allowed margin"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-m-border">
                <Button variant="secondary" onClick={() => setShowDeclineModal(false)}>
                  Cancel
                </Button>
                <Button variant="danger" disabled={!declineReason.trim()} onClick={handleDecline}>
                  Confirm Decline
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
