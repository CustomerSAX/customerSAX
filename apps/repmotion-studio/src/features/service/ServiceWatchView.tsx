"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageHeader
} from "@/components/ui";
import { Metrics, Panel } from "../repmotion/components";
import { useDemo } from "../repmotion/demo-state";
import { initialIncidents, type ServiceIncident } from "./data";
import { accountsDirectory } from "../accounts/data";

export function ServiceWatchView() {
  const demo = useDemo();
  const [incidents, setIncidents] = useState<ServiceIncident[]>(initialIncidents);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Filter states
  const [activeTab, setActiveTab] = useState<"all" | "holds" | "followup" | "support">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  // Modals state
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [selectedForFollowup, setSelectedForFollowup] = useState<ServiceIncident | null>(null);
  const [followupNote, setFollowupNote] = useState("Called Jordan at 9:00 AM. Confirmed replacement ties arrived intact and concrete pour is proceeding on schedule.");

  // New escalation form state
  const accounts = Object.values(accountsDirectory);
  const [targetAccount, setTargetAccount] = useState(accounts[0]?.id || "volttech");
  const [escalationCategory, setEscalationCategory] = useState<ServiceIncident["category"]>("damaged_shipment");
  const [escalationPriority, setEscalationPriority] = useState<ServiceIncident["priority"]>("Urgent");
  const [escalationSubject, setEscalationSubject] = useState("");
  const [orderRef, setOrderRef] = useState("O-10489");

  const accountsOnHold = incidents.filter((inc) => inc.blocksSalesOutreach);
  const pendingFollowup = incidents.filter((inc) => inc.status === "Resolved - Needs Rep Follow-up" && !inc.salesFollowUpCompleted);
  const inProgressWithSupport = incidents.filter((inc) => inc.status === "In Progress with Support");

  // Visible incidents based on filters
  const visibleIncidents = incidents.filter((inc) => {
    const searchMatches =
      !searchQuery ||
      `${inc.caseNumber} ${inc.accountName} ${inc.subject} ${inc.description} ${inc.primaryContact.name} ${inc.orderNumber || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const accountMatches = selectedAccountId === "all" || inc.accountId === selectedAccountId;

    let tabMatches = true;
    if (activeTab === "holds") {
      tabMatches = inc.blocksSalesOutreach;
    } else if (activeTab === "followup") {
      tabMatches = inc.status === "Resolved - Needs Rep Follow-up" && !inc.salesFollowUpCompleted;
    } else if (activeTab === "support") {
      tabMatches = inc.status === "In Progress with Support";
    }

    return searchMatches && accountMatches && tabMatches;
  });

  const handleRequestExpedite = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            executiveExpediteRequested: true,
            resolutionSummary: `[EXECUTIVE EXPEDITE REQUESTED BY SALES]: ${inc.resolutionSummary || ""}`
          };
        }
        return inc;
      })
    );
    const target = incidents.find((i) => i.id === incidentId);
    setFeedbackToast(`✓ Executive Expedite requested for ${target?.accountName}. Support desk alerted to authorize hotshot air courier.`);
  };

  const handleOfferGoodwillCredit = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            goodwillCreditOffered: "$500 Freight Credit on Next Quote"
          };
        }
        return inc;
      })
    );
    const target = incidents.find((i) => i.id === incidentId);
    setFeedbackToast(`✓ $500 goodwill credit flag attached to ${target?.accountName}. Will automatically populate in Quotes & Approvals.`);
  };

  const handleToggleHold = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          const isNowOnHold = !inc.blocksSalesOutreach;
          return {
            ...inc,
            blocksSalesOutreach: isNowOnHold,
            blockReason: isNowOnHold ? "Outreach hold manually enabled by sales rep." : undefined
          };
        }
        return inc;
      })
    );
    const target = incidents.find((i) => i.id === incidentId);
    if (target?.blocksSalesOutreach) {
      setFeedbackToast(`Outreach hold cleared for ${target.accountName}. Commercial sales contact may resume.`);
    } else {
      setFeedbackToast(`Outreach hold activated for ${target?.accountName}. Sales pitches paused.`);
    }
  };

  const handleCompleteFollowup = () => {
    if (!selectedForFollowup) return;
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === selectedForFollowup.id) {
          return {
            ...inc,
            salesFollowUpCompleted: true,
            salesFollowUpNote: followupNote,
            status: "Closed"
          };
        }
        return inc;
      })
    );
    setFeedbackToast(`✓ Close-the-loop follow-up recorded for ${selectedForFollowup.accountName}. Trust restored.`);
    setSelectedForFollowup(null);
  };

  const handleCreateEscalation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationSubject.trim()) return;

    const acc = accountsDirectory[targetAccount] || accounts[0];
    const contact = acc.contacts[0];
    const newCaseNumber = `CASE-${Math.floor(4000 + Math.random() * 900)}`;

    const newIncident: ServiceIncident = {
      id: `INC-${Math.floor(4000 + Math.random() * 900)}`,
      caseNumber: newCaseNumber,
      accountId: acc.id,
      accountName: acc.name,
      industry: acc.industry,
      primaryContact: {
        name: contact.name,
        role: contact.title,
        phone: contact.phone,
        email: contact.email,
        avatarInitials: contact.avatarInitials
      },
      orderNumber: orderRef || undefined,
      category: escalationCategory,
      categoryLabel:
        escalationCategory === "damaged_shipment"
          ? "Damaged Freight"
          : escalationCategory === "delivery_delay"
          ? "Delivery Delay"
          : escalationCategory === "wrong_item"
          ? "Wrong SKU"
          : "Product Quality Defect",
      subject: escalationSubject.trim(),
      description: `Jobsite issue reported directly to Field Sales Rep. Dispatched to Customer Care support queue.`,
      priority: escalationPriority,
      status: "In Progress with Support",
      assignedSpecialist: "Customer Care Desk (CustomerSAX / Support)",
      openedAt: "Just now",
      lastUpdated: "Just now",
      blocksSalesOutreach: escalationPriority === "Urgent",
      blockReason:
        escalationPriority === "Urgent"
          ? "Urgent jobsite defect logged by sales rep. Outreach automatically paused."
          : undefined,
      resolutionSummary: "Ticket dispatched to Customer Care team for carrier claim and warehouse pick-and-pack."
    };

    setIncidents([newIncident, ...incidents]);
    setFeedbackToast(`✓ Case ${newCaseNumber} dispatched to Customer Care desk. Sales hold activated for ${acc.name}.`);
    setIsEscalateModalOpen(false);
    setEscalationSubject("");
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={<span className="eyebrow">REPMOTION · CUSTOMER TRUST & SERVICE DESK</span>}
        title="Service Watch"
        subtitle="Sales representative incident monitor and escalation desk. Stay ahead of customer defects, protect trust, and close the loop after resolution."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Icon name="refresh-cw" size="sm" />}
              onClick={demo.refresh}
            >
              Refresh Support Sync
            </Button>
            <Button
              onClick={() => setIsEscalateModalOpen(true)}
              leftIcon={<Icon name="plus" size="sm" />}
            >
              + Log Field Escalation
            </Button>
          </div>
        }
      />

      {/* Top Territory Service Metrics */}
      <Metrics
        items={[
          [
            "Accounts on Outreach Hold",
            `${accountsOnHold.length} Client Protected`,
            "Sales pitches paused to preserve trust"
          ],
          [
            "Active Escalations",
            `${inProgressWithSupport.length} Cases in Flight`,
            "Being handled by Customer Care team"
          ],
          [
            "Pending Sales Follow-up",
            `${pendingFollowup.length} Resolved Cases`,
            "Ready for sales close-the-loop check-in"
          ],
          [
            "Average Support Turnaround",
            "4.2h Resolution",
            "CustomerSAX / Support Desk SLA"
          ]
        ]}
      />

      {/* Cross-Product Architecture Boundary Notice */}
      <div className="insight-strip border-primary/30 bg-primary/5">
        <span className="icon-tile text-primary">
          <Icon name="shield-check" size="md" />
        </span>
        <div className="grow">
          <strong className="text-foreground">Clear Persona Separation Active</strong>
          <p className="text-xs text-foreground/85 mt-0.5">
            <strong>Customer Care Specialists (in CustomerSAX)</strong> perform all technical support casework: carrier freight claims, RMA return labels, and warehouse replacement shipments. 
            <strong>Sales Representatives (in RepMotion)</strong> use this desk strictly for account-level crisis awareness, field escalations, executive expedites, and post-resolution relationship follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="primary">Sales Rep Persona</Badge>
          <Badge variant="neutral">Connected to Customer Care</Badge>
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
        {/* Left Column: Incidents List */}
        <Panel
          title="Account Incident Monitor"
          description="Customer defect reports, carrier delays, and resolution milestones"
          action={
            <div className="text-xs text-muted-foreground font-medium">
              Showing {visibleIncidents.length} of {incidents.length} cases
            </div>
          }
        >
          {/* Filter Tabs */}
          <div className="space-y-3.5 mb-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "all", label: "All Territory Incidents", count: incidents.length },
                  { id: "holds", label: "Outreach on Hold", count: accountsOnHold.length, alert: true },
                  { id: "followup", label: "Pending Rep Follow-up", count: pendingFollowup.length, success: true },
                  { id: "support", label: "In Flight with Support", count: inProgressWithSupport.length }
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        active
                          ? tab.alert
                            ? "bg-destructive text-destructive-foreground font-semibold shadow-sm"
                            : tab.success
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
                  aria-label="Search incidents"
                  placeholder="Search case #, client, contact, or defect..."
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
                    <option value="all">All Accounts ({incidents.length})</option>
                    {accounts.map((acc) => (
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

          {/* Incident Cards */}
          <div className="space-y-4">
            {visibleIncidents.map((incident) => {
              const isHoldActive = incident.blocksSalesOutreach;
              const isResolved = incident.status.includes("Resolved");

              return (
                <div
                  key={incident.id}
                  className={`flex flex-col w-full rounded-xl p-5 border text-left bg-card transition-all ${
                    isHoldActive
                      ? "border-destructive/50 shadow-sm"
                      : isResolved
                      ? "border-emerald-300 shadow-sm"
                      : "border-border hover:border-primary/50 hover:shadow-md"
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded text-foreground">
                          {incident.caseNumber}
                        </span>
                        <Badge
                          variant={
                            incident.priority === "Urgent"
                              ? "error"
                              : incident.priority === "High"
                              ? "warning"
                              : "neutral"
                          }
                          dot
                        >
                          {incident.priority} Priority
                        </Badge>
                        <Badge variant="neutral">{incident.categoryLabel}</Badge>
                        {isHoldActive && (
                          <Badge variant="error" dot>Outreach on Hold</Badge>
                        )}
                        {incident.executiveExpediteRequested && (
                          <Badge variant="warning">Executive Air Expedite</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Link
                          href={`/accounts/${incident.accountId}`}
                          className="font-bold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span>{incident.accountName}</span>
                          <Icon name="arrow-up-right" size="xs" />
                        </Link>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{incident.industry}</span>
                        {incident.orderNumber && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-mono text-muted-foreground font-semibold">
                              Order #{incident.orderNumber}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div>Opened: <strong>{incident.openedAt}</strong></div>
                      <div>Assigned: <strong>{incident.assignedSpecialist}</strong></div>
                    </div>
                  </div>

                  {/* Subject and Description */}
                  <h4 className="text-sm font-bold text-foreground mt-3 mb-1">
                    {incident.subject}
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed mb-3">
                    {incident.description}
                  </p>

                  {/* Resolution Milestone Box */}
                  {incident.resolutionSummary && (
                    <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-foreground/85 space-y-1 my-1">
                      <div className="flex items-center justify-between font-bold text-primary">
                        <span className="flex items-center gap-1.5">
                          <Icon name="package-check" size="xs" />
                          Support Desk Status Milestone:
                        </span>
                        <span className="text-muted-foreground font-normal text-[11px] font-mono">
                          {incident.lastUpdated}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed m-0">{incident.resolutionSummary}</p>
                    </div>
                  )}

                  {/* Sales Follow-up Note Stamped */}
                  {incident.salesFollowUpCompleted && incident.salesFollowUpNote && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 mt-2">
                      <strong className="flex items-center gap-1 mb-0.5">
                        <Icon name="check-circle" size="xs" className="text-emerald-600" />
                        Sales Follow-up Completed:
                      </strong>
                      <p className="m-0 text-foreground/90">{incident.salesFollowUpNote}</p>
                    </div>
                  )}

                  {/* Goodwill Credit Attached */}
                  {incident.goodwillCreditOffered && (
                    <div className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                      <Icon name="badge-dollar-sign" size="xs" />
                      <span>Commercial Concession Active: {incident.goodwillCreditOffered}</span>
                    </div>
                  )}

                  {/* Footer: Decision Maker & Sales Rep Actions */}
                  <div className="pt-3 mt-3 border-t border-border flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                        {incident.primaryContact.avatarInitials}
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">{incident.primaryContact.name}</span>
                        <span className="text-muted-foreground ml-1.5">({incident.primaryContact.role})</span>
                      </div>
                    </div>

                    {/* Pure Sales Rep Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Hold Toggle */}
                      <Button
                        size="sm"
                        variant="secondary"
                        className={isHoldActive ? "text-emerald-700 hover:bg-emerald-50" : "text-destructive hover:bg-destructive/10"}
                        onClick={() => handleToggleHold(incident.id)}
                        leftIcon={<Icon name={isHoldActive ? "unlock" : "lock"} size="xs" />}
                      >
                        {isHoldActive ? "Lift Sales Hold" : "Place Sales Hold"}
                      </Button>

                      {/* Request Executive Expedite */}
                      {!incident.executiveExpediteRequested && !isResolved && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-amber-800 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleRequestExpedite(incident.id)}
                          leftIcon={<Icon name="zap" size="xs" />}
                        >
                          Request Air Expedite
                        </Button>
                      )}

                      {/* Offer Goodwill Credit */}
                      {!incident.goodwillCreditOffered && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-primary border-primary/30 hover:bg-primary/5"
                          onClick={() => handleOfferGoodwillCredit(incident.id)}
                          leftIcon={<Icon name="percent" size="xs" />}
                        >
                          Attach $500 Credit
                        </Button>
                      )}

                      {/* Close the Loop Check-in Button */}
                      {!incident.salesFollowUpCompleted && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setSelectedForFollowup(incident)}
                          leftIcon={<Icon name="phone-call" size="xs" />}
                        >
                          Close the Loop Call
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleIncidents.length === 0 && (
              <div className="empty-state p-10 text-center border-2 border-dashed border-border rounded-xl">
                <Icon name="shield-check" size="xl" className="mx-auto text-emerald-500 mb-3 opacity-80" />
                <h3 className="text-base font-bold text-foreground">Zero active service incidents in this view</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  All customer deliveries are running on schedule without active quality defects.
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

        {/* Right Column: Trust Framework & Guidance */}
        <aside className="page-stack">
          {/* Urgent Outreach Hold Warning Box */}
          {accountsOnHold.length > 0 && (
            <section className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-wider">
                <Icon name="shield-alert" size="xs" />
                <span>SALES OUTREACH HOLD ACTIVE</span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {accountsOnHold[0].accountName}
              </h3>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {accountsOnHold[0].blockReason || "Customer has an active quality complaint. Cold prospecting calls or generic emails are temporarily paused."}
              </p>
              <div className="pt-1">
                <Link
                  href={`/accounts/${accountsOnHold[0].accountId}`}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-colors"
                >
                  Inspect Account 360 & Plan
                  <Icon name="arrow-right" size="xs" />
                </Link>
              </div>
            </section>
          )}

          {/* Persona Rules of Engagement */}
          <Panel title="Rules of Engagement" description="Sales Rep vs Customer Care boundaries">
            <div className="space-y-3 text-xs text-foreground/85">
              <div className="p-3 rounded-lg border border-border bg-card">
                <strong className="block text-foreground mb-1">What Customer Care Does:</strong>
                <p className="text-muted-foreground text-[11px] m-0">
                  Carrier claims, warehouse pick-and-pack expedites, RMA return labels, and formal credit memos in ERP.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card">
                <strong className="block text-foreground mb-1">What the Sales Rep Does:</strong>
                <p className="text-muted-foreground text-[11px] m-0">
                  Logs jobsite issues from the field, requests executive expedites for top accounts, and calls the buyer after delivery to confirm trust is restored.
                </p>
              </div>
            </div>
          </Panel>

          {/* Quick Account Jump */}
          <Panel title="Accounts Under Watch" description="Quick jump to account blueprint">
            <div className="space-y-2 text-xs">
              {[
                { name: "Cedar Valley Components", status: "Outreach on Hold", id: "cedar" },
                { name: "Summit Commercial Builders", status: "Follow-up Due", id: "summit" },
                { name: "Lakeside Steel Fabricators", status: "Carrier Delay", id: "lakeside" },
                { name: "Metro Siteworks & Utilities", status: "Resolved", id: "metro" }
              ].map((acc) => (
                <Link
                  key={acc.id}
                  href={`/accounts/${acc.id}`}
                  className="p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 flex items-center justify-between transition-colors group"
                >
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {acc.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{acc.status}</span>
                    <Icon name="arrow-right" size="xs" className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {/* Log Field Escalation Modal */}
      <Modal isOpen={isEscalateModalOpen} onClose={() => setIsEscalateModalOpen(false)} size="md">
        <ModalHeader
          title="Log Field Escalation to Customer Care"
          subtitle="Dispatches a ticket to Customer Care while alerting your sales territory"
          onClose={() => setIsEscalateModalOpen(false)}
        />
        <form onSubmit={handleCreateEscalation}>
          <ModalBody>
            <div className="space-y-4 text-xs">
              <label className="block space-y-1">
                <span className="font-semibold text-foreground">Client Account</span>
                <select
                  className="w-full bg-card border border-border text-foreground text-xs rounded-lg px-2.5 py-2"
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.industry})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-semibold text-foreground">Defect Category</span>
                  <select
                    className="w-full bg-card border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5"
                    value={escalationCategory}
                    onChange={(e) => setEscalationCategory(e.target.value as ServiceIncident["category"])}
                  >
                    <option value="damaged_shipment">Damaged Freight / Defect</option>
                    <option value="delivery_delay">Delivery Delay / Transit Stalled</option>
                    <option value="wrong_item">Wrong SKU Delivered</option>
                    <option value="technical_defect">Product Quality Defect</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="font-semibold text-foreground">Priority Severity</span>
                  <select
                    className="w-full bg-card border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5"
                    value={escalationPriority}
                    onChange={(e) => setEscalationPriority(e.target.value as ServiceIncident["priority"])}
                  >
                    <option value="Urgent">Urgent (Jobsite Stalled)</option>
                    <option value="High">High (24h Resolution Required)</option>
                    <option value="Medium">Medium (Routine Adjustment)</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="font-semibold text-foreground">Related ERP Order # (Optional)</span>
                <Input
                  value={orderRef}
                  onChange={(e) => setOrderRef(e.target.value)}
                  placeholder="e.g. O-10489"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-foreground">Issue Description / Customer Statement *</span>
                <Input
                  value={escalationSubject}
                  onChange={(e) => setEscalationSubject(e.target.value)}
                  placeholder="e.g. Foreman reported 3 cases delivered with cracked housings"
                  required
                />
              </label>

              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Cross-Product Hand-off:</strong> This ticket routes directly to Customer Care (CustomerSAX / Support Desk). If marked Urgent, sales outreach to this client is automatically placed on hold.
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setIsEscalateModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button type="submit">
              Dispatch to Customer Care
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Close the Loop Modal */}
      <Modal isOpen={!!selectedForFollowup} onClose={() => setSelectedForFollowup(null)} size="md">
        <ModalHeader
          title="Close the Loop (Customer Satisfaction Call)"
          subtitle={`Confirm relationship recovery with ${selectedForFollowup?.accountName}`}
          onClose={() => setSelectedForFollowup(null)}
        />
        <ModalBody>
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="text-[10px] font-bold uppercase tracking-wider block">
                Support Resolution Confirmed:
              </span>
              <p className="text-xs mt-1 text-foreground/90">
                {selectedForFollowup?.resolutionSummary}
              </p>
            </div>

            <label className="block space-y-1">
              <span className="font-semibold text-foreground">Sales Follow-up Notes *</span>
              <Input
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
                placeholder="e.g. Called Jordan, confirmed replacement arrived and client is satisfied"
                required
              />
            </label>

            <div className="p-2.5 rounded-lg bg-muted text-[11px] text-muted-foreground border border-border">
              <strong className="text-foreground">Relationship Trust:</strong> Recording this follow-up clears the pending follow-up queue and confirms the client is ready for normal commercial quotes.
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setSelectedForFollowup(null)} type="button">
            Cancel
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCompleteFollowup}>
            Save Follow-up & Close Loop
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
