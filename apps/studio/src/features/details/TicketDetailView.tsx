"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Icon,
  Input,
  Select,
  FormField,
  Label,
  Badge,
  Tabs,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Panel,
} from "@csa/ui";
import { useTicketStore, TICKET_CATEGORIES, TICKET_WORKFLOW } from "../tickets/hooks/use-tickets";
import type {
  TicketStatus,
  TicketPriority,
  WorklogComment,
} from "../tickets/types/ticket-types";

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

export function TicketDetailView({ id }: TicketDetailViewProps) {
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");

  const { getTicketById, updateTicket, addWorklog, loading, error } = useTicketStore();

  const ticket = getTicketById(id);

  const [activeTab, setActiveTab] = useState<"General" | "History">("General");

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

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const renderStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case "Open":
        return <Badge variant="primary" size="sm" dot>Open</Badge>;
      case "In Progress":
        return <Badge variant="warning" size="sm" dot>In Progress</Badge>;
      case "Pending":
        return <Badge variant="neutral" size="sm">Pending</Badge>;
      case "Resolved":
        return <Badge variant="success" size="sm">Resolved</Badge>;
      case "Closed":
        return <Badge variant="neutral" size="sm">Closed</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{s}</Badge>;
    }
  };

  const renderPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case "Urgent":
        return <Badge variant="error" size="sm">Urgent</Badge>;
      case "High":
        return <Badge variant="warning" size="sm">High</Badge>;
      case "Medium":
        return <Badge variant="primary" size="sm">Medium</Badge>;
      case "Low":
        return <Badge variant="neutral" size="sm">Low</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{p}</Badge>;
    }
  };

  if (loading && !ticket) return <div className="p-8 text-sm text-m-text-muted">Loading ticket...</div>;
  if (error) return <div className="p-8 text-sm text-m-error">Unable to load ticket: {error.message}</div>;
  if (!ticket) return <div className="p-8 text-sm text-m-text-muted">Ticket not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header & Back Link */}
      <div>
        <Link
          href={customerIdParam ? `/customers/${customerIdParam}` : "/tickets"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          {customerIdParam ? "Go back to customer" : "Back to Support Tickets"}
        </Link>

        <PageHeader
          title={`Ticket Details: ${ticket.ticketNumber}`}
          subtitle={`Subject: ${ticket.subject} • Created ${new Date(ticket.createdAt).toLocaleString()}`}
          badge={renderStatusBadge(ticket.status)}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Icon name="mail" size="xs" />}
                onClick={() => alert(`Replying to ${ticket.email}`)}
              >
                Reply to Customer
              </Button>
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} variant="underline">
        <Tabs.List>
          <Tabs.Trigger value="General" icon={<Icon name="info" size="xs" />}>General</Tabs.Trigger>
          <Tabs.Trigger value="History" icon={<Icon name="clock" size="xs" />}>
            History Audit Log ({ticket.history?.length || 0})
          </Tabs.Trigger>
        </Tabs.List>

        {/* General Tab */}
        <Tabs.Content value="General" className="space-y-6">
          {/* Ticket Overview Panel */}
          <Panel className="p-5 bg-m-bg-surface space-y-4 rounded-lg border border-m-border">
            <h3 className="text-sm font-bold text-m-text">Ticket Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-m-text-muted block">Ticket Number</span>
                <span className="font-mono font-bold text-m-primary">{ticket.ticketNumber}</span>
              </div>
              <div>
                <span className="text-m-text-muted block">Customer Email</span>
                <span className="font-medium text-m-primary">{ticket.email}</span>
              </div>
              <div>
                <span className="text-m-text-muted block">Category</span>
                <span className="font-semibold text-m-text">
                  {TICKET_CATEGORIES[ticket.category] || ticket.category}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-m-text-muted block">Subject</span>
                <span className="font-semibold text-m-text">{ticket.subject}</span>
              </div>
              <div>
                <span className="text-m-text-muted block">Associated Order</span>
                {ticket.orderNumber ? (
                  <Link href={`/orders/${ticket.orderNumber}`} className="font-bold text-m-primary hover:underline">
                    {ticket.orderNumber}
                  </Link>
                ) : (
                  <span className="text-m-text-muted">--</span>
                )}
              </div>
            </div>

            <div className="text-xs space-y-1">
              <span className="text-m-text-muted block font-medium">Issue Message</span>
              <p className="p-3 bg-m-bg border border-m-border rounded-md text-m-text leading-relaxed">
                {ticket.message}
              </p>
            </div>

            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-m-border/60">
                <span className="text-xs font-bold text-m-text uppercase tracking-wider">Attachments</span>
                <div className="flex flex-wrap gap-2">
                  {ticket.attachments.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-m-bg border border-m-border rounded-md text-xs font-semibold text-m-primary hover:underline"
                    >
                      📎 {f.name} {f.size && `(${f.size})`}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Workflow & Assignment Form */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Assignment & Workflow Management</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveChanges} className="space-y-4">
                {saveSuccessMsg && (
                  <div className="p-3 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                    {saveSuccessMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField>
                    <Label>Assign To Agent</Label>
                    <Select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      options={AGENT_OPTIONS}
                    />
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
                </div>

                <FormField>
                  <Label>Resolution / Solution Notes</Label>
                  <textarea
                    className="w-full p-3 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                    rows={3}
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    placeholder="Enter resolution notes or solution provided to customer..."
                  />
                </FormField>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" size="md" onClick={() => {
                    setAssignedTo(ticket.assignedTo);
                    setStatus(ticket.status);
                    setPriority(ticket.priority);
                    setSolution(ticket.solution || "");
                  }}>
                    Reset
                  </Button>
                  <Button type="submit" variant="primary" size="md">
                    Save Workflow Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Internal Worklog Section */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Internal Worklog History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <FormField>
                    <Label>Add Worklog Note</Label>
                    <textarea
                      className="w-full p-3 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                      rows={2}
                      value={worklogInput}
                      onChange={(e) => setWorklogInput(e.target.value)}
                      placeholder="Add internal progress note or action taken..."
                    />
                  </FormField>
                </div>
                <Button type="button" variant="secondary" size="md" onClick={handleAddWorklog}>
                  + Add Worklog
                </Button>
              </div>

              {ticket.comments && ticket.comments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worklog Comment</TableHead>
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
                            <div className="text-xs text-m-text leading-relaxed">
                              {needsToggle && !isExpanded
                                ? `${w.comment.slice(0, 150)}...`
                                : w.comment}
                            </div>
                            {needsToggle && (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-m-primary hover:underline mt-1 block"
                                onClick={() => toggleExpand(w.id)}
                              >
                                {isExpanded ? "Show Less" : "Show More"}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-m-text-muted">
                            {new Date(w.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="neutral" size="sm">
                              {w.author || w.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-m-text-muted italic">No internal worklog comments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* History Audit Log Tab */}
        <Tabs.Content value="History" className="space-y-4">
          <div className="max-w-md">
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
            <p className="text-xs text-m-text-muted italic">No audit history entries found matching search.</p>
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
                    <TableCell className="font-mono text-xs font-bold text-m-primary">
                      {h.ticketNumber}
                    </TableCell>
                    <TableCell className="text-xs text-m-text-muted">
                      {new Date(h.operationDate).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-semibold text-xs">
                      {(TICKET_CATEGORIES as Record<string, string>)[h.reason] || h.reason}
                    </TableCell>
                    <TableCell className="text-xs text-m-text max-w-xs truncate">
                      {h.solution || "--"}
                    </TableCell>
                    <TableCell>{renderStatusBadge(h.status)}</TableCell>
                    <TableCell>{renderPriorityBadge(h.priority)}</TableCell>
                    <TableCell className="text-xs text-m-text-muted">{h.assignedTo}</TableCell>
                    <TableCell className="text-xs font-mono">{h.timeSpent || "--"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
