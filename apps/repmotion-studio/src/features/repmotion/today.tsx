"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Icon,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  PageHeader,
  Card
} from "../../components/ui";
import { targets, type CustomerTarget } from "./data";
import {
  ActionLink,
  CommitmentCapture,
  Metrics,
  Panel,
  SourceList,
  Status
} from "./components";
import { useDemo } from "./demo-state";

export function Today() {
  const demo = useDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<CustomerTarget | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const visible = targets.filter(
    (target) =>
      (filter === "All" || target.status === filter) &&
      `${target.name} ${target.description} ${target.triggerLabel}`.toLowerCase().includes(query.toLowerCase())
  );

  const getTriggerVariant = (type: CustomerTarget["triggerType"]) => {
    switch (type) {
      case "meeting":
        return "primary";
      case "quote_unblocked":
        return "success";
      case "promise_due":
        return "warning";
      case "reorder_timing":
        return "neutral";
      case "service_hold":
        return "error";
      default:
        return "neutral";
    }
  };

  const getTriggerIcon = (type: CustomerTarget["triggerType"]) => {
    switch (type) {
      case "meeting":
        return "calendar-days";
      case "quote_unblocked":
        return "boxes";
      case "promise_due":
        return "clock";
      case "reorder_timing":
        return "refresh-cw";
      case "service_hold":
        return "shield-alert";
      default:
        return "sparkles";
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={<span className="eyebrow">GOOD MORNING, MAYA · SALES ACCOUNT MANAGER</span>}
        title="Make every conversation count."
        subtitle="Five customer priorities surfaced by commercial triggers, inventory events, and service signals."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Icon name="refresh-cw" size="sm" />}
              onClick={demo.refresh}
            >
              Refresh morning signals
            </Button>
            <CommitmentCapture label="+ Quick promise" />
          </div>
        }
      />

      <Metrics
        items={[
          ["Assigned accounts", "38", "Midwest commercial portfolio"],
          ["Today’s priorities", "5", "2 ready · 2 review · 1 service hold"],
          [
            "Open commitments",
            String(7 + demo.commitments.length - 3),
            "2 customer promises due before 3 PM"
          ],
          ["Upcoming meetings", "3", "Next: Summit Builders at 2:30 PM"]
        ]}
      />

      {/* Insight banner highlighting cross-product intelligence */}
      <div className="insight-strip">
        <span className="icon-tile">
          <Icon name="sparkles" size="md" />
        </span>
        <div className="grow">
          <strong>Cross-Stack Intelligence Active</strong>
          <p>
            38 accounts monitored across ERP orders, local branch inventory, and customer care cases. 
            One account is automatically on <strong>Outreach Hold</strong> to protect customer trust.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            Updated {demo.refreshTime || "8:06 AM"}
          </Badge>
          <Badge variant="primary">5 Actionable Targets</Badge>
        </div>
      </div>

      <div className="content-grid">
        <Panel
          title="Today’s Customer Priorities"
          description="Surfaced by purchase cadences, restocked quotes, promises, and customer care signals"
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Showing {visible.length} of {targets.length}</span>
            </div>
          }
        >
          {/* Search and readiness filters */}
          <div className="target-toolbar">
            <Input
              aria-label="Search customer targets"
              placeholder="Search by customer name, trigger or status..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Icon name="search" size="sm" />}
            />
            <div className="filter-group" aria-label="Filter by readiness">
              {["All", "Ready", "Review", "Blocked"].map((item) => {
                const count = item === "All" ? targets.length : targets.filter(t => t.status === item).length;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={filter === item}
                    onClick={() => setFilter(item)}
                    className="flex items-center gap-1.5"
                  >
                    <span>{item}</span>
                    <small className="opacity-70">({count})</small>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of customer target cards */}
          <div className="target-list">
            {visible.map((target) => (
              <div
                key={target.id}
                className={`target-card status-${target.status.toLowerCase()} transition-all hover:shadow-md cursor-pointer`}
                onClick={() => setSelected(target)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(target);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="target-number">0{targets.indexOf(target) + 1}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={getTriggerVariant(target.triggerType)}>
                          <Icon name={getTriggerIcon(target.triggerType)} size="xs" />
                          <span className="ml-1">{target.triggerLabel}</span>
                        </Badge>
                        <Status>{target.status}</Status>
                      </div>
                      <h3 className="text-base font-semibold text-foreground m-0">{target.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {target.name} · Contact: <strong>{target.primaryContact.name}</strong> ({target.primaryContact.role})
                      </p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <strong className="text-sm font-bold block">{target.value}</strong>
                    <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                      {target.timing}
                      <Icon name="arrow-up-right" size="xs" />
                    </span>
                  </div>
                </div>

                <p className="text-sm text-foreground/80 mt-3 mb-2">{target.description}</p>

                {/* Evidence chips */}
                <div className="evidence-chips">
                  {target.evidence.map((evidence) => (
                    <span key={evidence}>
                      <Icon name="check" size="xs" />
                      <span className="ml-1">{evidence}</span>
                    </span>
                  ))}
                </div>

                {/* Card footer with direct quick actions */}
                <div className="pt-3 mt-3 border-t border-border flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Icon name="phone" size="xs" />
                    {target.primaryContact.phone}
                  </span>
                  <div className="flex items-center gap-2">
                    {target.id === "summit" ? (
                      <ActionLink href="/accounts/summit">
                        Open Meeting Brief
                      </ActionLink>
                    ) : target.id === "cedar" ? (
                      <span className="text-destructive font-medium flex items-center gap-1">
                        <Icon name="shield-alert" size="xs" />
                        Inspect Service Defect
                      </span>
                    ) : target.id === "metro" ? (
                      <span className="text-primary font-medium flex items-center gap-1">
                        <Icon name="boxes" size="xs" />
                        Review $42.8K Quote
                      </span>
                    ) : (
                      <span className="text-primary font-medium flex items-center gap-1">
                        <Icon name="calendar-clock" size="xs" />
                        Manage Promise
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {visible.length === 0 && (
              <div className="empty-state">
                <Icon name="search" size="lg" />
                <h3>No matching customer priorities</h3>
                <p>Try searching with another keyword or adjust readiness filters.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("All");
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </Panel>

        <aside className="page-stack">
          {/* Spotlight on Next Meeting */}
          <section className="meeting-card">
            <div className="row-between">
              <span className="eyebrow">YOUR NEXT MEETING</span>
              <Icon name="calendar-days" size="md" />
            </div>
            <span className="meeting-time">
              2:30 <small>PM</small>
            </span>
            <h2>Summit Commercial Builders</h2>
            <p>Jordan Lee · Purchasing Director</p>
            <div className="meeting-agenda">
              {[
                "Confirm concrete-accessory replenishment demand",
                "Review $84,600 open quote (Q-18719)",
                "Close loop on replacement shipment resolved by Ava Brooks"
              ].map((item, index) => (
                <div key={item}>
                  <span>0{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            <ActionLink href="/accounts/summit">Open full meeting brief</ActionLink>
          </section>

          {/* Business source freshness */}
          <Panel title="Connected Data Feeds" description="Multi-system sync status">
            <SourceList compact />
          </Panel>

          {/* Governance Notice */}
          <div className="quiet-note">
            <Icon name="shield-check" size="md" />
            <p>
              <strong>Governance Guardrail:</strong> Evidence informs the recommendation.
              You confirm customer needs and approve the conversation plan before outreach.
            </p>
          </div>
        </aside>
      </div>

      {/* Interactive Detail Modal / Drawer for Target Inspection */}
      <Modal isOpen={!!selected} onClose={() => { setSelected(null); setActionSuccess(null); }} size="lg">
        <ModalHeader
          title={selected?.name}
          subtitle={`Priority Detail · ${selected?.triggerLabel}`}
          onClose={() => { setSelected(null); setActionSuccess(null); }}
        />
        <ModalBody>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={getTriggerVariant(selected.triggerType)}>
                    <Icon name={getTriggerIcon(selected.triggerType)} size="xs" />
                    <span className="ml-1">{selected.triggerLabel}</span>
                  </Badge>
                  <Status>{selected.status}</Status>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">{selected.timing}</span>
                  <strong className="text-sm">{selected.value}</strong>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground">{selected.title}</h3>
                <p className="text-sm text-foreground/80 mt-1">{selected.description}</p>
              </div>

              {/* Primary Contact Card */}
              <div className="bg-muted/40 p-3 rounded-lg border border-border flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block">Decision Maker</span>
                  <strong className="text-sm">{selected.primaryContact.name}</strong>
                  <span className="text-xs text-muted-foreground block">{selected.primaryContact.role}</span>
                </div>
                <div className="text-right text-xs">
                  <div className="text-foreground font-mono">{selected.primaryContact.phone}</div>
                  <div className="text-muted-foreground">{selected.primaryContact.email}</div>
                </div>
              </div>

              {/* SPECIAL CASE 1: Customer Care Service Hold Alert */}
              {selected.serviceTicket && selected.serviceTicket.blocksSalesOutreach && (
                <div className="p-4 rounded-lg border-2 border-destructive/30 bg-destructive/5 space-y-3">
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                    <Icon name="shield-alert" size="sm" />
                    <span>OUTBOUND SALES OUTREACH ON HOLD</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    <strong>Reason:</strong> {selected.serviceTicket.blockReason}
                  </p>
                  <div className="bg-background/80 p-3 rounded border border-border text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Case Number:</span>
                      <strong className="font-mono">{selected.serviceTicket.ticketNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned Care Specialist:</span>
                      <strong>{selected.serviceTicket.assignedTo}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issue Subject:</span>
                      <span>{selected.serviceTicket.subject}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Care Status:</span>
                      <span className="text-amber-600 font-semibold">{selected.serviceTicket.status} ({selected.serviceTicket.priority} Priority)</span>
                    </div>
                    <div className="pt-1 text-muted-foreground border-t border-border mt-1">
                      <strong>Resolution Note:</strong> {selected.serviceTicket.resolution}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <ActionLink href="/service">Open Customer Care Queue</ActionLink>
                    <span className="text-xs text-muted-foreground">Do not contact customer until Ava confirms closure.</span>
                  </div>
                </div>
              )}

              {/* SPECIAL CASE 2: Quote Unblocked Line Items */}
              {selected.quote && selected.quote.unblockedItems && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm block">Quote {selected.quote.quoteNumber} · Inventory Restocked</strong>
                      <span className="text-xs text-muted-foreground">
                        Total Value: ${selected.quote.subtotal.toLocaleString()} · Negotiated: ${selected.quote.negotiatedTotal.toLocaleString()} ({selected.quote.discountPct}% disc.)
                      </span>
                    </div>
                    <Badge variant="success">Ready to Release</Badge>
                  </div>

                  <div className="text-xs border rounded overflow-hidden">
                    <div className="bg-muted px-3 py-1.5 font-semibold text-muted-foreground grid grid-cols-12 gap-2">
                      <span className="col-span-5">Restocked Product</span>
                      <span className="col-span-2">Qty</span>
                      <span className="col-span-3">Branch Stock</span>
                      <span className="col-span-2 text-right">Subtotal</span>
                    </div>
                    {selected.quote.unblockedItems.map(item => (
                      <div key={item.sku} className="px-3 py-2 border-t grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <strong className="block">{item.name}</strong>
                          <span className="text-muted-foreground font-mono">{item.sku}</span>
                        </div>
                        <span className="col-span-2">{item.quantity} units</span>
                        <div className="col-span-3">
                          <span className="text-emerald-700 font-medium block">{item.stockStatus}</span>
                          <span className="text-muted-foreground text-[10px]">{item.branch}</span>
                        </div>
                        <span className="col-span-2 text-right font-medium">
                          ${(item.quantity * item.unitPrice).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {actionSuccess && (
                    <div className="p-2 rounded bg-emerald-50 text-emerald-800 text-xs flex items-center gap-1.5 border border-emerald-200">
                      <Icon name="check" size="xs" />
                      <span>{actionSuccess}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => setActionSuccess(`Quote ${selected.quote?.quoteNumber} sent to ${selected.primaryContact.name} (${selected.primaryContact.email})`)}
                      leftIcon={<Icon name="send" size="xs" />}
                    >
                      Release & Email Quote to Buyer
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setActionSuccess(`Logged follow-up call with ${selected.primaryContact.name}`)}
                      leftIcon={<Icon name="phone" size="xs" />}
                    >
                      Call Buyer
                    </Button>
                  </div>
                </div>
              )}

              {/* Evidence Chips */}
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Evidence Used to Surface Priority</span>
                <div className="evidence-chips">
                  {selected.evidence.map((item) => (
                    <span key={item}>
                      <Icon name="check" size="xs" />
                      <span className="ml-1">{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => { setSelected(null); setActionSuccess(null); }}>
            Close
          </Button>
          {selected?.id === "summit" ? (
            <ActionLink href="/accounts/summit">
              Open Full Meeting Brief
            </ActionLink>
          ) : selected?.id === "cedar" ? (
            <ActionLink href="/service">
              View in Customer Care
            </ActionLink>
          ) : (
            <CommitmentCapture account={selected?.name} label="Log Customer Commitment" />
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
