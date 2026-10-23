"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Icon, Input, PageHeader } from "@/components/ui";
import { Metrics, Panel } from "../repmotion/components";
import { useDemo } from "../repmotion/demo-state";
import { initialQuotes, type EnrichedQuote } from "./data";
import { QuoteCard } from "./components/QuoteCard";
import { MarginExceptionModal } from "./components/MarginExceptionModal";
import { accountsDirectory } from "../accounts/data";

export function QuotesView() {
  const demo = useDemo();
  const [quotes, setQuotes] = useState<EnrichedQuote[]>(initialQuotes);
  const [selectedForException, setSelectedForException] = useState<EnrichedQuote | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "all" | "pending_approval" | "awaiting_buyer" | "stock_unblocked" | "converted"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  const totalPipeline = quotes
    .filter((q) => q.status !== "Converted")
    .reduce((sum, q) => sum + q.negotiatedTotal, 0);

  const pendingApprovalQuotes = quotes.filter(
    (q) => q.approvalStatus === "Pending Manager Approval"
  );
  const awaitingBuyerQuotes = quotes.filter(
    (q) => q.status === "Submitted" || q.status === "In Review"
  );
  const stockUnblockedQuotes = quotes.filter((q) => !!q.unblockedReason);
  const convertedQuotes = quotes.filter((q) => q.status === "Converted");
  const expiringSoonQuotes = quotes.filter(
    (q) => q.daysUntilExpiration <= 2 && q.daysUntilExpiration > 0 && q.status !== "Converted"
  );

  // Filter quotes
  const visibleQuotes = quotes.filter((q) => {
    // Search
    const searchMatches =
      !searchQuery ||
      `${q.quoteNumber} ${q.accountName} ${q.industry} ${q.primaryContact.name} ${q.lineItems.map((li) => li.name).join(" ")}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    // Account
    const accountMatches = selectedAccountId === "all" || q.accountId === selectedAccountId;

    // Tab
    let tabMatches = true;
    if (activeTab === "pending_approval") {
      tabMatches = q.approvalStatus === "Pending Manager Approval";
    } else if (activeTab === "awaiting_buyer") {
      tabMatches = (q.status === "Submitted" || q.status === "In Review") && q.approvalStatus !== "Pending Manager Approval";
    } else if (activeTab === "stock_unblocked") {
      tabMatches = !!q.unblockedReason && q.status !== "Converted";
    } else if (activeTab === "converted") {
      tabMatches = q.status === "Converted";
    }

    return searchMatches && accountMatches && tabMatches;
  });

  const handleSendLink = (quote: EnrichedQuote) => {
    setFeedbackToast(
      `✓ Digital 1-click accept link generated for ${quote.accountName} (${quote.quoteNumber}). Ready to send to ${quote.primaryContact.name}.`
    );
  };

  const handleSubmitException = (quoteId: string, requestedDiscount: number, reason: string) => {
    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id === quoteId) {
          return {
            ...q,
            approvalStatus: "Pending Manager Approval",
            approvalRequest: {
              requestedDiscountPct: requestedDiscount,
              requestedBy: "Maya Chen (Sales AE)",
              reason,
              requestedAt: "Just now",
              status: "Pending"
            }
          };
        }
        return q;
      })
    );
    const target = quotes.find((q) => q.id === quoteId);
    setFeedbackToast(
      `✓ Discount exception (${requestedDiscount}%) submitted for ${target?.accountName}. Routed to Sales Manager approvals inbox.`
    );
  };

  const handleManagerApprove = (quoteId: string, approvedDiscountPct: number) => {
    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id === quoteId) {
          const newNegotiatedTotal = Math.round(q.subtotal * (1 - approvedDiscountPct / 100));
          return {
            ...q,
            discountPct: approvedDiscountPct,
            negotiatedTotal: newNegotiatedTotal,
            approvalStatus: "Approved",
            status: "Submitted",
            approvalRequest: q.approvalRequest
              ? {
                  ...q.approvalRequest,
                  status: "Approved",
                  managerNote: `Approved at ${approvedDiscountPct}% discount by David Kim (Sales Manager).`
                }
              : undefined
          };
        }
        return q;
      })
    );
    const target = quotes.find((q) => q.id === quoteId);
    setFeedbackToast(
      `✓ Manager Approval Verified: ${target?.quoteNumber} for ${target?.accountName} approved at ${approvedDiscountPct}% discount. Now ready for buyer signature.`
    );
  };

  const handleExtendValidity = (quoteId: string) => {
    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id === quoteId) {
          return {
            ...q,
            daysUntilExpiration: q.daysUntilExpiration + 7,
            validUntil: "Oct 27, 2026"
          };
        }
        return q;
      })
    );
    const target = quotes.find((q) => q.id === quoteId);
    setFeedbackToast(
      `✓ Quote validity extended by +7 days for ${target?.quoteNumber} (${target?.accountName}).`
    );
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={<span className="eyebrow">REPMOTION · COMMERCIAL EXECUTION</span>}
        title="Quotes & Approvals"
        subtitle="Manage active commercial proposals, resolve manager margin exceptions, and accelerate deal closures."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Icon name="refresh-cw" size="sm" />}
              onClick={demo.refresh}
            >
              Sync ERP Quotes
            </Button>
            <Link
              href="/accounts"
              className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Icon name="building-2" size="xs" />
              Accounts Directory
            </Link>
          </div>
        }
      />

      {/* Top Territory Pipeline Metrics */}
      <Metrics
        items={[
          [
            "Active Pipeline in Play",
            `$${(totalPipeline / 1000).toFixed(1)}K`,
            `${quotes.length - convertedQuotes.length} Proposals in Progress`
          ],
          [
            "Pending Manager Signoff",
            `$${(pendingApprovalQuotes.reduce((sum, q) => sum + q.negotiatedTotal, 0) / 1000).toFixed(1)}K`,
            `${pendingApprovalQuotes.length} Discount Exceptions`
          ],
          [
            "Expiring < 48 Hours",
            `$${(expiringSoonQuotes.reduce((sum, q) => sum + q.negotiatedTotal, 0) / 1000).toFixed(1)}K`,
            `${expiringSoonQuotes.length} Quotes Need Follow-up`
          ],
          [
            "Territory Margin Health",
            "22.8% Average",
            "Above 21.0% Policy Target Floor"
          ]
        ]}
      />

      {/* Insight Strip */}
      <div className="insight-strip">
        <span className="icon-tile">
          <Icon name="sparkles" size="md" />
        </span>
        <div className="grow">
          <strong>Commercial Deal Acceleration Active</strong>
          <p>
            Connected to ERP pricing engines, local branch inventory allocation, and manager approval hierarchies. 
            Proposals with newly restocked inventory or urgent expiration dates are automatically flagged for action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            Updated {demo.refreshTime || "8:06 AM"}
          </Badge>
          <Badge variant="primary">{quotes.length - convertedQuotes.length} Active in Play</Badge>
        </div>
      </div>

      {/* Toast Notification */}
      {feedbackToast && (
        <div className="p-3.5 rounded-lg bg-emerald-50 text-emerald-900 text-sm flex items-center justify-between border border-emerald-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </span>
            <span className="font-medium">{feedbackToast}</span>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline ml-3 shrink-0"
            onClick={() => setFeedbackToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="content-grid">
        {/* Left Column: Quotes List */}
        <Panel
          title="Commercial Proposals & Deals"
          description="Track line items, margin exceptions, and buyer signature readiness"
          action={
            <div className="text-xs text-muted-foreground font-medium">
              Showing {visibleQuotes.length} of {quotes.length} proposals
            </div>
          }
        >
          {/* Workflow Status Tabs */}
          <div className="space-y-3.5 mb-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "all", label: "All Active Proposals", count: quotes.length - convertedQuotes.length },
                  { id: "pending_approval", label: "Pending Manager Approval", count: pendingApprovalQuotes.length, alert: true },
                  { id: "awaiting_buyer", label: "Out for Signature", count: awaitingBuyerQuotes.length },
                  { id: "stock_unblocked", label: "Stock Restocked", count: stockUnblockedQuotes.length },
                  { id: "converted", label: "Won & Booked in ERP", count: convertedQuotes.length }
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        active
                          ? tab.alert
                            ? "bg-amber-600 text-white font-semibold shadow-sm"
                            : tab.id === "converted"
                            ? "bg-emerald-600 text-white font-semibold shadow-sm"
                            : "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
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
            </div>

            {/* Search and Account Filter */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="w-full sm:w-80">
                <Input
                  aria-label="Search proposals"
                  placeholder="Search quote number, account, or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Icon name="search" size="sm" />}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Icon name="building-2" size="xs" />
                  <span>Account:</span>
                  <select
                    className="bg-card border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    <option value="all">All Accounts ({quotes.length})</option>
                    {Object.values(accountsDirectory).map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </label>

                {(searchQuery || activeTab !== "all" || selectedAccountId !== "all") && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium ml-2"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveTab("all");
                      setSelectedAccountId("all");
                    }}
                  >
                    <Icon name="x" size="xs" />
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quotes Cards List */}
          <div className="space-y-4">
            {visibleQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onSendLink={handleSendLink}
                onRequestException={(target) => setSelectedForException(target)}
                onManagerApprove={handleManagerApprove}
                onExtendValidity={handleExtendValidity}
              />
            ))}

            {visibleQuotes.length === 0 && (
              <div className="empty-state p-10 text-center border-2 border-dashed border-border rounded-xl">
                <Icon name="search" size="xl" className="mx-auto text-muted-foreground mb-3 opacity-60" />
                <h3 className="text-base font-bold text-foreground">No proposals match this filter</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Try adjusting your search criteria or reset filters to view all active quotes.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveTab("all");
                    setSelectedAccountId("all");
                  }}
                >
                  Reset Active Filters
                </Button>
              </div>
            )}
          </div>
        </Panel>

        {/* Right Column: Margin Policy & Deal Intelligence */}
        <aside className="page-stack">
          {/* Pending Approval Urgent Alert */}
          {pendingApprovalQuotes.length > 0 && (
            <section className="bg-amber-500/10 border-2 border-amber-500/30 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Icon name="shield-alert" size="xs" />
                <span>APPROVAL ACTION REQUIRED</span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {pendingApprovalQuotes[0].accountName}
              </h3>
              <p className="text-xs text-foreground/80 leading-relaxed">
                Quote {pendingApprovalQuotes[0].quoteNumber} (${pendingApprovalQuotes[0].negotiatedTotal.toLocaleString()}) requests a {pendingApprovalQuotes[0].approvalRequest?.requestedDiscountPct}% discount.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs w-full"
                  onClick={() =>
                    handleManagerApprove(
                      pendingApprovalQuotes[0].id,
                      pendingApprovalQuotes[0].approvalRequest?.requestedDiscountPct || 12
                    )
                  }
                >
                  Fast-Approve (12%)
                </Button>
              </div>
            </section>
          )}

          {/* Margin Governance Rules Panel */}
          <Panel title="Pricing & Margin Governance" description="Commercial guardrails & discount authority">
            <div className="space-y-3 text-xs text-foreground/85">
              <div className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                  <span>0% – 10% Discount</span>
                  <Badge variant="success">Auto-Approved</Badge>
                </div>
                <p className="text-muted-foreground text-[11px] m-0">Field Account Executives have autonomous pricing authority within this standard margin band.</p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                  <span>10.1% – 18% Discount</span>
                  <Badge variant="warning">Branch Manager Signoff</Badge>
                </div>
                <p className="text-muted-foreground text-[11px] m-0">Requires business rationale, competitor evidence, and volume commitment in RepMotion.</p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                  <span>&gt; 18% Discount</span>
                  <Badge variant="error">VP Commercial Signoff</Badge>
                </div>
                <p className="text-muted-foreground text-[11px] m-0">Reserved for annual enterprise contracts and multi-site project packages.</p>
              </div>
            </div>
          </Panel>

          {/* Quick Account Pipeline Value */}
          <Panel title="Top Deal Accounts" description="Pipeline concentrated by client">
            <div className="space-y-2 text-xs">
              {[
                { name: "Summit Commercial Builders", val: "$77.8K", status: "In Review" },
                { name: "OmniPack Industrial Solutions", val: "$64.2K", status: "Pending Approval" },
                { name: "Metro Siteworks & Utilities", val: "$42.8K", status: "Expiring 48h" },
                { name: "VoltTech Automation Systems", val: "$18.4K", status: "Stock Restocked" },
                { name: "Lakeside Steel Fabricators", val: "$16.0K", status: "Out for Signature" }
              ].map((acc, i) => (
                <div key={i} className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between">
                  <div>
                    <strong className="block text-foreground">{acc.name}</strong>
                    <span className="text-[11px] text-muted-foreground">{acc.status}</span>
                  </div>
                  <strong className="text-sm font-mono text-foreground">{acc.val}</strong>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {/* Margin Exception Modal */}
      <MarginExceptionModal
        quote={selectedForException}
        onClose={() => setSelectedForException(null)}
        onSubmit={handleSubmitException}
      />
    </div>
  );
}
