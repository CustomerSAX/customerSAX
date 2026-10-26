"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@csa/ui";
import { TICKET_QUERY } from "@/features/tickets/api/queries";
import { SlaBadge } from "@/features/tickets/components/TicketSla";
import { useNow } from "@/features/tickets/sla";
import type { TicketSla } from "@/features/tickets/types/ticket-types";
import { formatDate } from "@/lib/format-date";
import type { TicketCardArgs } from "../types";

interface LiveTicket {
  id: string;
  ticketNumber?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  customerEmail?: string | null;
  assignee?: string | null;
  orderNumber?: string | null;
  lastModifiedAt?: string | null;
  sla?: TicketSla | null;
}

const CLOSED = new Set(["resolved", "closed", "solved"]);

function statusVariant(status?: string | null) {
  const s = status?.toLowerCase() ?? "";
  if (CLOSED.has(s)) return "success" as const;
  if (s === "pending" || s === "waiting") return "warning" as const;
  return "info" as const;
}

function priorityVariant(priority?: string | null) {
  const p = priority?.toLowerCase() ?? "";
  if (p === "urgent") return "error" as const;
  if (p === "high") return "warning" as const;
  return "neutral" as const;
}

/** Reads the ticket live (re-read after every assistant turn) so status and buttons stay current. */
function useLiveTicket(ticketId: string | undefined, isLoading: boolean) {
  const { data, loading, error, refetch } = useQuery<{ ticket: LiveTicket | null }>(TICKET_QUERY, {
    variables: { id: ticketId },
    skip: !ticketId,
    fetchPolicy: "cache-and-network"
  });
  useEffect(() => {
    if (!isLoading && ticketId) void refetch().catch(() => undefined);
  }, [isLoading, ticketId, refetch]);
  return { ticket: data?.ticket ?? null, loading, error };
}

/** Resolve & wrap up / Edit / Add note / Draft reply — each prepares one approval card in the chat. */
export function TicketActions({
  ticket,
  onSuggest,
  isLoading
}: {
  ticket: LiveTicket;
  onSuggest: (prompt: string) => void;
  isLoading: boolean;
}) {
  const number = ticket.ticketNumber || ticket.id;
  const closed = CLOSED.has(ticket.status?.toLowerCase() ?? "");
  const send = (type: string) =>
    onSuggest(`[hidden-action] ${JSON.stringify({ type, ticketId: ticket.id, ticketNumber: number })}`);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => send("ticket.wrap_up")}
          disabled={isLoading || closed}
          title={closed ? `This ticket is already ${ticket.status?.toLowerCase()}.` : undefined}
          leftIcon={<Icon name="check-circle" size="xs" />}
        >
          Resolve &amp; wrap up
        </Button>
        <Button size="sm" variant="outline" onClick={() => send("ticket.edit")} disabled={isLoading} leftIcon={<Icon name="edit" size="xs" />}>
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => send("ticket.add_note")} disabled={isLoading} leftIcon={<Icon name="file-text" size="xs" />}>
          Add note
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onSuggest(`Draft a reply to the customer for ticket #${number}${ticket.subject ? ` about "${ticket.subject}"` : ""}.`)
          }
          disabled={isLoading}
          leftIcon={<Icon name="mail" size="xs" />}
        >
          Draft reply
        </Button>
      </div>
      {closed && <p className="text-[11px] text-m-text-muted">This ticket is already {ticket.status?.toLowerCase()}.</p>}
    </div>
  );
}

/** Actions row for cards that only know the ticket id (the case briefing card). */
export function LiveTicketActions({
  ticketId,
  onSuggest,
  isLoading
}: {
  ticketId: string;
  onSuggest: (prompt: string) => void;
  isLoading: boolean;
}) {
  const { ticket, error } = useLiveTicket(ticketId, isLoading);
  if (error && !ticket) return <p className="text-[11px] text-m-error">Couldn&apos;t load the ticket ({error.message}), so its actions are unavailable.</p>;
  if (!ticket) return null;
  return <TicketActions ticket={ticket} onSuggest={onSuggest} isLoading={isLoading} />;
}

export function TicketCard({
  args,
  onSuggest,
  isLoading
}: {
  args: TicketCardArgs;
  onSuggest: (prompt: string) => void;
  isLoading: boolean;
}) {
  const { ticket, loading, error } = useLiveTicket(args.ticketId, isLoading);

  if (!ticket) {
    return (
      <Card variant="default" className="my-2 max-w-md">
        <CardContent className="px-4 py-3 text-xs text-m-text-muted">
          {loading
            ? "Loading the ticket…"
            : error
              ? `Unable to load this ticket right now (${error.message}).`
              : "This ticket could not be found."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="default" className="my-2 max-w-md border-l-4 border-l-m-primary">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">Ticket #{ticket.ticketNumber || ticket.id}</CardTitle>
            {ticket.subject && <p className="mt-0.5 text-xs text-m-text">{ticket.subject}</p>}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {ticket.priority && <Badge variant={priorityVariant(ticket.priority)} size="sm">{ticket.priority}</Badge>}
            {ticket.status && <Badge variant={statusVariant(ticket.status)} size="sm">{ticket.status}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        {ticket.customerEmail && (
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-m-text-muted">Customer</span>
            <span className="font-medium truncate">{ticket.customerEmail}</span>
          </div>
        )}
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-m-text-muted">Assignee</span>
          <span className="font-medium truncate">{ticket.assignee || "Unassigned"}</span>
        </div>
        {ticket.orderNumber && (
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-m-text-muted">Order</span>
            <span className="font-medium">{ticket.orderNumber}</span>
          </div>
        )}
        {ticket.lastModifiedAt && (
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-m-text-muted">Last updated</span>
            <span className="font-medium">{formatDate(ticket.lastModifiedAt)}</span>
          </div>
        )}
        <div className="pt-2.5 mt-1 border-t border-m-border">
          <TicketActions ticket={ticket} onSuggest={onSuggest} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tickets Table (several tickets in one reply) ────────────────────────────

function TicketTableRow({
  ticketId,
  expanded,
  onToggle,
  onSuggest,
  isLoading
}: {
  ticketId: string;
  expanded: boolean;
  onToggle: () => void;
  onSuggest: (prompt: string) => void;
  isLoading: boolean;
}) {
  const { ticket, loading, error } = useLiveTicket(ticketId, isLoading);
  const now = useNow();

  if (!ticket) {
    return (
      <TableRow>
        <TableCell colSpan={8} className="text-m-text-muted">
          {loading ? "Loading ticket…" : error ? `Unable to load this ticket (${error.message}).` : "This ticket could not be found."}
        </TableCell>
      </TableRow>
    );
  }

  const number = ticket.ticketNumber || ticket.id;
  return (
    <>
      <TableRow selected={expanded}>
        <TableCell className="whitespace-nowrap font-medium text-m-text" title={number}>
          #{number.length > 22 ? `${number.slice(0, 12)}…${number.slice(-6)}` : number}
        </TableCell>
        <TableCell className="max-w-[220px] truncate" title={ticket.subject ?? undefined}>{ticket.subject || "—"}</TableCell>
        <TableCell>{ticket.status ? <Badge variant={statusVariant(ticket.status)} size="sm">{ticket.status}</Badge> : "—"}</TableCell>
        <TableCell>{ticket.priority ? <Badge variant={priorityVariant(ticket.priority)} size="sm">{ticket.priority}</Badge> : "—"}</TableCell>
        <TableCell className="whitespace-nowrap"><SlaBadge sla={ticket.sla} now={now} /></TableCell>
        <TableCell className="max-w-[140px] truncate" title={ticket.assignee ?? undefined}>{ticket.assignee || "Unassigned"}</TableCell>
        <TableCell className="whitespace-nowrap">{ticket.lastModifiedAt ? formatDate(ticket.lastModifiedAt) : "—"}</TableCell>
        <TableCell className="text-right">
          <Button
            size="sm"
            variant={expanded ? "secondary" : "ghost"}
            onClick={onToggle}
            aria-expanded={expanded}
            rightIcon={<Icon name={expanded ? "chevron-up" : "chevron-down"} size="xs" />}
          >
            Actions
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-m-surface-2/40">
            <TicketActions ticket={ticket} onSuggest={onSuggest} isLoading={isLoading} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function TicketSummaryTable({
  ticketIds,
  total,
  onSuggest,
  isLoading
}: {
  ticketIds: string[];
  /** Total matches when only the first page is shown. */
  total?: number;
  onSuggest: (prompt: string) => void;
  isLoading: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="my-2 w-full space-y-1.5">
      <p className="text-xs text-m-text-muted">
        {total && total > ticketIds.length ? `Showing ${ticketIds.length} of ${total} tickets` : `${ticketIds.length} ${ticketIds.length === 1 ? "ticket" : "tickets"}`}
      </p>
      <Table aria-label="Tickets">
        <TableHeader>
          <TableRow>
            <TableHead>Ticket</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ticketIds.map((id) => (
            <TicketTableRow
              key={id}
              ticketId={id}
              expanded={expandedId === id}
              onToggle={() => setExpandedId((current) => (current === id ? null : id))}
              onSuggest={onSuggest}
              isLoading={isLoading}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
