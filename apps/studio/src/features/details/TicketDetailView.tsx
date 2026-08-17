"use client";

/**
 * TicketDetailView — Ticket Detail Page
 *
 * Restyled onto the shared entity-detail design system
 * (`@/components/detail`: DetailPage / EntityHeader / EntityTabs / SummaryGrid /
 * ContentGrid / SectionCard / QuickActions …). Presentation only — every data
 * hook, state var, and handler below is unchanged in behavior from the
 * previous implementation:
 *
 * - useTicketStore() drives loading / error / not-found / loaded states and
 *   the real updateTicket / addWorklog mutations.
 * - Assignment, workflow status, priority, and resolution notes are edited
 *   through the same controlled form state (assignedTo/status/priority/
 *   solution) and saved via handleSaveChanges — now triggered either from
 *   the header "Update Status" button or the workflow card's own submit.
 * - Internal worklog notes are added via handleAddWorklog (real mutation)
 *   and browsed with the same expand/collapse (expandedWorklogIds) state.
 * - The audit history tab keeps the same auditSearchText-driven filtering
 *   over ticket.history.
 *
 * No field is fabricated: SLA countdowns and sentiment analysis aren't
 * returned by the connected ticketing backend, so they render an honest
 * "—" (InfoRow's built-in empty state) rather than an invented value. AI
 * Assist is presented as a normal capability card (sparkles icon, never a
 * robot) with an honest empty state since no AI backend is wired to this
 * page yet.
 */

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Icon,
  Input,
  Select,
  FormField,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@csa/ui";
import {
  DetailPage,
  BackLink,
  EntityHeader,
  EntityTabs,
  SummaryGrid,
  SummaryCard,
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  CardAction,
  InfoList,
  InfoRow,
  StatusPill,
  QuickActions,
  QuickAction,
  PrimaryButton,
  SecondaryButton,
  MoreActionsMenu,
  CardEmpty,
  type EntityTab,
  type StatusTone,
} from "@/components/detail";
import { useTicketStore, TICKET_CATEGORIES, TICKET_WORKFLOW } from "../tickets/hooks/use-tickets";
import type { TicketStatus, TicketPriority, WorklogComment } from "../tickets/types/ticket-types";

interface TicketDetailViewProps {
  id: string;
}

const AGENT_OPTIONS = [
  { value: "John Agent (john.agent@csa.com)", label: "John Agent" },
  { value: "Sarah Jenkins (sarah.jenkins@csa.com)", label: "Sarah Jenkins" },
  { value: "Tech Support Team", label: "Tech Support Team" },
  { value: "Support Desk", label: "Support Desk (Unassigned)" },
];

const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Urgent", label: "Urgent" },
];

/** Status → tone mapping shared by the header pill, summary and audit table. */
function statusTone(status: TicketStatus): StatusTone {
  switch (status) {
    case "Open":
      return "info";
    case "Resolved":
    case "Closed":
      return "success";
    case "Pending":
      return "warning";
    default:
      return "neutral"; // e.g. "In Progress"
  }
}

/** Priority → tone mapping for StatusPill (audit table). */
function priorityTone(priority: TicketPriority): StatusTone {
  switch (priority) {
    case "Urgent":
      return "error";
    case "High":
      return "warning";
    case "Medium":
      return "info";
    default:
      return "neutral";
  }
}

/** Priority → tone mapping for SummaryCard (its tone enum has a "default"). */
function summaryPriorityTone(priority: TicketPriority): "default" | "primary" | "success" | "warning" | "error" {
  switch (priority) {
    case "Urgent":
      return "error";
    case "High":
      return "warning";
    case "Medium":
      return "primary";
    default:
      return "default";
  }
}

export function TicketDetailView({ id }: TicketDetailViewProps) {
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");
  const backHref = customerIdParam ? `/customers/${customerIdParam}` : "/tickets";
  const backLabel = customerIdParam ? "Back to customer" : "Back to Tickets";

  const { getTicketById, updateTicket, addWorklog, loading, error } = useTicketStore();

  const ticket = getTicketById(id);

  const [activeTab, setActiveTab] = useState<string>("conversation");

  // Editable Form State
  const [assignedTo, setAssignedTo] = useState(ticket?.assignedTo || AGENT_OPTIONS[0].value);
  const [status, setStatus] = useState<TicketStatus>(ticket?.status || "Open");
  const [priority, setPriority] = useState<TicketPriority>(ticket?.priority || "High");
  const [solution, setSolution] = useState(ticket?.solution || "");
  const [worklogInput, setWorklogInput] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [expandedWorklogIds, setExpandedWorklogIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!ticket) return;
    setAssignedTo(ticket.assignedTo);
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setSolution(ticket.solution || "");
  }, [ticket]);

  // Audit Search State
  const [auditSearchText, setAuditSearchText] = useState("");

  // Workflow transition options based on current status
  const workflowStatusOptions = useMemo(() => {
    const allowed = TICKET_WORKFLOW[status] || [status];
    return allowed.map((s) => ({ value: s, label: s }));
  }, [status]);

  const handleSaveChanges = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ticket) return;
    await updateTicket(ticket.id, {
      assignedTo,
      status,
      priority,
      solution,
    });
    setSaveSuccessMsg("Ticket status and assignment updated successfully.");
    setTimeout(() => setSaveSuccessMsg(""), 3000);
  };

  const handleResetChanges = () => {
    if (!ticket) return;
    setAssignedTo(ticket.assignedTo);
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setSolution(ticket.solution || "");
  };

  const handleAddWorklog = async () => {
    if (!worklogInput.trim()) return;
    if (!ticket) return;
    await addWorklog(ticket.id, worklogInput.trim(), "John Agent");
    setWorklogInput("");
  };

  const toggleExpand = (key: string) => {
    setExpandedWorklogIds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredHistory = useMemo(() => {
    if (!ticket?.history) return [];
    if (!auditSearchText.trim()) return ticket.history;
    const q = auditSearchText.toLowerCase().trim();
    return ticket.history.filter(
      (h) =>
        h.ticketNumber.toLowerCase().includes(q) ||
        h.status.toLowerCase().includes(q) ||
        h.assignedTo.toLowerCase().includes(q) ||
        (h.worklog && h.worklog.toLowerCase().includes(q)) ||
        (h.solution && h.solution.toLowerCase().includes(q))
    );
  }, [ticket, auditSearchText]);

  // Quick Actions — thin wrappers around the same real updateTicket mutation
  // the workflow form uses; each is a genuine backend write, not local-only.
  const handleQuickAssignToMe = async () => {
    if (!ticket) return;
    await updateTicket(ticket.id, { assignedTo: AGENT_OPTIONS[0].value });
  };
  const handleQuickEscalate = async () => {
    if (!ticket) return;
    await updateTicket(ticket.id, { priority: "Urgent" });
  };
  const handleQuickResolve = async () => {
    if (!ticket) return;
    await updateTicket(ticket.id, { status: "Resolved" });
  };

  if (loading && !ticket) {
    return (
      <DetailPage>
        <BackLink href={backHref}>{backLabel}</BackLink>
        <EntityHeader title="Loading ticket…" />
        <SectionCard>
          <CardEmpty icon="loader" title="Loading ticket…" />
        </SectionCard>
      </DetailPage>
    );
  }

  if (error) {
    return (
      <DetailPage>
        <BackLink href={backHref}>{backLabel}</BackLink>
        <EntityHeader title="Ticket" />
        <SectionCard>
          <CardEmpty icon="alert-triangle" title="Unable to load ticket" hint={error.message} />
        </SectionCard>
      </DetailPage>
    );
  }

  if (!ticket) {
    return (
      <DetailPage>
        <BackLink href={backHref}>{backLabel}</BackLink>
        <EntityHeader title="Ticket not found" />
        <SectionCard>
          <CardEmpty icon="inbox" title="Ticket not found" hint={`No ticket exists with ID ${id}.`} />
        </SectionCard>
      </DetailPage>
    );
  }

  const TABS: EntityTab[] = [
    { id: "conversation", label: "Conversation", icon: "message-square" },
    { id: "customer", label: "Customer", icon: "user" },
    { id: "order", label: "Order", icon: "shopping-bag" },
    { id: "ai", label: "AI Assist", icon: "sparkles" },
    { id: "notes", label: "Internal Notes", icon: "file-text", count: ticket.comments.length },
    { id: "history", label: "History", icon: "clock", count: ticket.history.length },
  ];

  return (
    <DetailPage>
      <BackLink href={backHref}>{backLabel}</BackLink>

      <EntityHeader
        title={`Ticket #${ticket.ticketNumber}`}
        status={<StatusPill tone={statusTone(ticket.status)}>{ticket.status}</StatusPill>}
        meta={`${ticket.subject} • Created ${new Date(ticket.createdAt).toLocaleString()} • via ${ticket.contactType}`}
        actions={
          <>
            <MoreActionsMenu
              actions={[
                {
                  id: "assign-me",
                  label: "Assign to Me",
                  icon: "user-check",
                  onClick: handleQuickAssignToMe,
                },
                {
                  id: "escalate",
                  label: "Escalate",
                  icon: "alert-triangle",
                  danger: true,
                  onClick: handleQuickEscalate,
                },
                {
                  id: "resolve",
                  label: "Resolve",
                  icon: "check-circle",
                  onClick: handleQuickResolve,
                },
              ]}
            />
            <PrimaryButton icon="check" onClick={() => handleSaveChanges()}>
              Update Status
            </PrimaryButton>
          </>
        }
      />

      <EntityTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <SummaryGrid>
        <SummaryCard icon="flag" label="Priority" value={ticket.priority} tone={summaryPriorityTone(ticket.priority)} />
        <SummaryCard icon="folder" label="Category" value={TICKET_CATEGORIES[ticket.category] || ticket.category} />
        <SummaryCard icon="user-check" label="Assigned To" value={ticket.assignedTo} />
        <SummaryCard icon="tag" label="Channel" value={ticket.contactType} />
        <SummaryCard icon="file-text" label="Internal Notes" value={ticket.comments.length} />
        <SummaryCard
          icon="calendar"
          label="Last Updated"
          value={ticket.lastModifiedAt ? new Date(ticket.lastModifiedAt).toLocaleDateString() : "—"}
        />
      </SummaryGrid>

      <ContentGrid>
        <MainColumn span={8}>
          {activeTab === "conversation" && (
            <>
              <SectionCard title="Conversation" icon="message-square">
                <div className="flex flex-col gap-4">
                  {/* Customer's original message */}
                  <div className="flex flex-col gap-1.5 rounded-m-lg border border-m-border bg-m-surface-2 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px] font-semibold text-m-text">{ticket.email || "Customer"}</span>
                      <span className="text-[11px] text-m-text-muted">
                        {new Date(ticket.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-m-text">{ticket.message || "—"}</p>
                  </div>

                  {/* Agent resolution note, if one has been recorded */}
                  {ticket.solution && (
                    <div className="flex flex-col gap-1.5 rounded-m-lg border border-m-primary-200 bg-m-primary-50 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12.5px] font-semibold text-m-primary">
                          {ticket.assignedTo || "Agent"} · Resolution
                        </span>
                        {ticket.resolutionDate && (
                          <span className="text-[11px] text-m-text-muted">
                            {new Date(ticket.resolutionDate).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] leading-relaxed text-m-text">{ticket.solution}</p>
                    </div>
                  )}

                  {ticket.attachments.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-m-border/70 pt-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-m-text-muted">
                        Attachments
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {ticket.attachments.map((f, i) => (
                          <a
                            key={i}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-m-md border border-m-border bg-m-surface px-3 py-1.5 text-[12px] font-semibold text-m-primary hover:underline"
                          >
                            <Icon name="paperclip" size={13} />
                            {f.name} {f.size && `(${f.size})`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Add Internal Note" icon="edit-3">
                <div className="flex flex-col gap-3">
                  <textarea
                    className="w-full rounded-m-md border border-m-border bg-transparent p-3 text-[13px] text-m-text focus:outline-none focus:ring-1 focus:ring-m-primary"
                    rows={3}
                    value={worklogInput}
                    onChange={(e) => setWorklogInput(e.target.value)}
                    placeholder="Add internal progress note or action taken..."
                  />
                  <div className="flex justify-end">
                    <PrimaryButton icon="plus" onClick={handleAddWorklog}>
                      Add Note
                    </PrimaryButton>
                  </div>
                </div>
              </SectionCard>
            </>
          )}

          {activeTab === "customer" && (
            <SectionCard
              title="Customer"
              icon="user"
              action={
                ticket.customerId ? (
                  <CardAction href={`/customers/${ticket.customerId}`}>View full profile →</CardAction>
                ) : undefined
              }
            >
              <InfoList columns={2}>
                <InfoRow label="Email" value={ticket.email} />
                <InfoRow label="Customer ID" value={ticket.customerId} mono />
                <InfoRow label="Contact Channel" value={ticket.contactType} />
                <InfoRow label="Created By" value={ticket.createdBy} />
              </InfoList>
              {!ticket.customerId && (
                <div className="mt-4">
                  <CardEmpty
                    icon="user"
                    title="No linked customer record"
                    hint="This ticket wasn't created against a known customer profile."
                  />
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === "order" && (
            <SectionCard
              title="Linked Order"
              icon="shopping-bag"
              action={
                ticket.orderNumber ? (
                  <CardAction href={`/orders/${ticket.orderNumber}`}>View order →</CardAction>
                ) : undefined
              }
            >
              {ticket.orderNumber ? (
                <InfoList>
                  <InfoRow label="Order Number" value={ticket.orderNumber} mono />
                </InfoList>
              ) : (
                <CardEmpty
                  icon="shopping-bag"
                  title="No order linked to this ticket"
                  hint="This ticket wasn't raised against a specific commerce order."
                />
              )}
            </SectionCard>
          )}

          {activeTab === "ai" && (
            <SectionCard title="AI Assist" icon="sparkles">
              <CardEmpty
                icon="sparkles"
                title="AI Assist isn't connected to this ticket"
                hint="Suggested replies, summaries, and sentiment analysis will appear here once wired to a backend AI service."
              />
            </SectionCard>
          )}

          {activeTab === "notes" && (
            <SectionCard title="Internal Notes" icon="file-text">
              {ticket.comments.length === 0 ? (
                <CardEmpty
                  icon="file-text"
                  title="No internal notes recorded yet"
                  hint="Notes added while working this ticket will appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Note</TableHead>
                      <TableHead>Logged At</TableHead>
                      <TableHead>Author / Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticket.comments.map((w: WorklogComment) => {
                      const isExpanded = Boolean(expandedWorklogIds[w.id]);
                      const needsToggle = w.comment.length > 150;
                      return (
                        <TableRow key={w.id}>
                          <TableCell className="max-w-md">
                            <div className="text-[12.5px] leading-relaxed text-m-text">
                              {needsToggle && !isExpanded ? `${w.comment.slice(0, 150)}...` : w.comment}
                            </div>
                            {needsToggle && (
                              <button
                                type="button"
                                className="mt-1 block text-[11px] font-semibold text-m-primary hover:underline"
                                onClick={() => toggleExpand(w.id)}
                              >
                                {isExpanded ? "Show Less" : "Show More"}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-[12px] text-m-text-muted">
                            {new Date(w.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <StatusPill tone="neutral" dot={false}>
                              {w.author || w.status}
                            </StatusPill>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          )}

          {activeTab === "history" && (
            <SectionCard title="History Audit Log" icon="clock">
              <div className="mb-4 max-w-md">
                <FormField>
                  <Label>Search Audit Logs</Label>
                  <Input
                    value={auditSearchText}
                    onChange={(e) => setAuditSearchText(e.target.value)}
                    placeholder="Search audit trail by status, assignee, or keyword..."
                  />
                </FormField>
              </div>

              {filteredHistory.length === 0 ? (
                <CardEmpty
                  icon="clock"
                  title="No audit history entries found"
                  hint={auditSearchText ? "No entries match your search." : "This ticket has no recorded workflow history yet."}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket Number</TableHead>
                      <TableHead>Ticket Raised</TableHead>
                      <TableHead>Reason / Category</TableHead>
                      <TableHead>Solution</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Time Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-[12px] font-bold text-m-primary">
                          {h.ticketNumber}
                        </TableCell>
                        <TableCell className="text-[12px] text-m-text-muted">
                          {new Date(h.operationDate).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[12px] font-semibold">
                          {(TICKET_CATEGORIES as Record<string, string>)[h.reason] || h.reason}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-[12px] text-m-text">
                          {h.solution || "--"}
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={statusTone(h.status)}>{h.status}</StatusPill>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={priorityTone(h.priority)}>{h.priority}</StatusPill>
                        </TableCell>
                        <TableCell className="text-[12px] text-m-text-muted">{h.assignedTo}</TableCell>
                        <TableCell className="font-mono text-[12px]">{h.timeSpent || "--"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          )}
        </MainColumn>

        <SideColumn span={4}>
          <SectionCard
            title="Ticket Workflow"
            icon="settings"
            action={
              saveSuccessMsg ? (
                <span className="text-[11px] font-semibold text-m-success">{saveSuccessMsg}</span>
              ) : undefined
            }
          >
            <form id="ticket-workflow-form" onSubmit={handleSaveChanges} className="flex flex-col gap-4">
              <FormField>
                <Label>Assign To Agent</Label>
                <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} options={AGENT_OPTIONS} />
              </FormField>

              <FormField>
                <Label>Workflow Status</Label>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  options={workflowStatusOptions}
                />
              </FormField>

              <FormField>
                <Label>Ticket Priority</Label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  options={PRIORITY_OPTIONS}
                />
              </FormField>

              <FormField>
                <Label>Resolution / Solution Notes</Label>
                <textarea
                  className="w-full rounded-m-md border border-m-border bg-transparent p-2.5 text-[12.5px] text-m-text focus:outline-none focus:ring-1 focus:ring-m-primary"
                  rows={3}
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="Enter resolution notes or solution provided to customer..."
                />
              </FormField>

              <div className="flex justify-end gap-2 pt-1">
                <SecondaryButton onClick={handleResetChanges}>Reset</SecondaryButton>
                <PrimaryButton icon="check" type="submit">
                  Save
                </PrimaryButton>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Ticket Details" icon="info">
            <InfoList>
              <InfoRow label="SLA" value={undefined} />
              <InfoRow label="Sentiment" value={undefined} />
              <InfoRow label="Time Spent" value={ticket.timeSpentOnTicket} />
              <InfoRow
                label="Resolution Date"
                value={ticket.resolutionDate ? new Date(ticket.resolutionDate).toLocaleString() : undefined}
              />
              <InfoRow
                label="Last Updated"
                value={ticket.lastModifiedAt ? new Date(ticket.lastModifiedAt).toLocaleString() : undefined}
              />
            </InfoList>
          </SectionCard>

          <SectionCard
            title="Customer"
            icon="user"
            action={
              ticket.customerId ? <CardAction href={`/customers/${ticket.customerId}`}>View →</CardAction> : undefined
            }
          >
            <InfoList>
              <InfoRow label="Email" value={ticket.email} />
              <InfoRow label="Contact Channel" value={ticket.contactType} />
              <InfoRow label="Created By" value={ticket.createdBy} />
            </InfoList>
          </SectionCard>

          <SectionCard
            title="Linked Order"
            icon="shopping-bag"
            action={
              ticket.orderNumber ? (
                <CardAction href={`/orders/${ticket.orderNumber}`}>View →</CardAction>
              ) : undefined
            }
          >
            {ticket.orderNumber ? (
              <InfoList>
                <InfoRow label="Order Number" value={ticket.orderNumber} mono />
              </InfoList>
            ) : (
              <CardEmpty icon="shopping-bag" title="No order linked" hint="Not associated with a commerce order." />
            )}
          </SectionCard>

          <QuickActions>
            <QuickAction icon="user-check" label="Assign to Me" onClick={handleQuickAssignToMe} />
            <QuickAction icon="alert-triangle" label="Escalate" tone="danger" onClick={handleQuickEscalate} />
            <QuickAction icon="check-circle" label="Resolve" onClick={handleQuickResolve} />
          </QuickActions>
        </SideColumn>
      </ContentGrid>
    </DetailPage>
  );
}
