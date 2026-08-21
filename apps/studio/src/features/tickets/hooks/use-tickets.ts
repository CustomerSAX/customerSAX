"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useMemo } from "react";
import { ADD_WORKLOG, CREATE_TICKET, TICKETS_QUERY, UPDATE_TICKET } from "../api/queries";
import type { Ticket, TicketCategoryKey, TicketPriority, TicketStatus, WorklogComment } from "../types/ticket-types";

export const TICKET_CATEGORIES: Record<TicketCategoryKey, string> = {
  order_inquiry: "Order Inquiry", payment_methods: "Payment Methods", returns_refunds: "Returns & Refunds",
  general_inquiry: "General Inquiry", technical_support: "Technical Support", account_management: "Account Management",
};
export const TICKET_WORKFLOW: Record<TicketStatus, TicketStatus[]> = {
  Open: ["Open", "In Progress", "Closed"], "In Progress": ["In Progress", "Pending", "Resolved", "Closed"],
  Pending: ["Pending", "In Progress", "Resolved", "Closed"], Resolved: ["Resolved", "In Progress", "Closed"], Closed: ["Closed", "Open"],
};

type ServerTicket = Partial<{
  id: string;
  ticketNumber: string;
  customerEmail: string;
  customerId: string;
  contactType: string;
  source: string;
  category: string;
  orderNumber: string;
  priority: string;
  status: string;
  assignee: string;
  createdBy: string;
  subject: string;
  message: string;
  solution: string;
  timeSpentOnTicket: string;
  createdAt: string;
  lastModifiedAt: string;
  resolutionDate: string;
  comments: WorklogComment[];
  attachments: Ticket["attachments"];
  history: ServerTicket[];
}>;
type NewTicket = Omit<Ticket, "id" | "ticketNumber" | "createdAt" | "comments" | "history"> & { comments?: WorklogComment[] };

export function useTicketStore() {
  const { data, loading, error, refetch } = useQuery(TICKETS_QUERY, { fetchPolicy: "cache-and-network", variables: { limit: 100, offset: 0 } });
  const [createMutation] = useMutation(CREATE_TICKET);
  const [updateMutation] = useMutation(UPDATE_TICKET);
  const [worklogMutation] = useMutation(ADD_WORKLOG);
  const tickets = useMemo<Ticket[]>(() => (data?.ticketPage.results ?? []).map(mapTicket), [data]);
  const getTicketById = useCallback((id: string) => tickets.find((ticket) => ticket.id === id || ticket.ticketNumber === id), [tickets]);

  const addTicket = useCallback(async (input: NewTicket) => {
    const result = await createMutation({ variables: { draft: {
      customerEmail: input.email, customerId: input.customerId, contactType: input.contactType,
      category: input.category, orderNumber: input.orderNumber, priority: input.priority,
      status: input.status, assignee: input.assignedTo, createdBy: input.createdBy,
      subject: input.subject, message: input.message, solution: input.solution,
      timeSpentOnTicket: input.timeSpentOnTicket, attachments: input.attachments, comments: input.comments ?? [], source: input.contactType,
    } } });
    await refetch();
    return mapTicket(result.data.createTicket);
  }, [createMutation, refetch]);

  const updateTicket = useCallback(async (id: string, updates: Partial<Ticket>) => {
    const patch: Record<string, unknown> = {};
    if (updates.email !== undefined) patch.customerEmail = updates.email;
    if (updates.customerId !== undefined) patch.customerId = updates.customerId;
    if (updates.contactType !== undefined) patch.contactType = updates.contactType;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.orderNumber !== undefined) patch.orderNumber = updates.orderNumber;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.assignedTo !== undefined) patch.assignee = updates.assignedTo;
    if (updates.subject !== undefined) patch.subject = updates.subject;
    if (updates.message !== undefined) patch.message = updates.message;
    if (updates.solution !== undefined) patch.solution = updates.solution;
    if (updates.timeSpentOnTicket !== undefined) patch.timeSpentOnTicket = updates.timeSpentOnTicket;
    if (updates.attachments !== undefined) patch.attachments = updates.attachments;
    await updateMutation({ variables: { id, patch } });
    await refetch();
  }, [refetch, updateMutation]);

  const addWorklog = useCallback(async (ticketId: string, commentText: string, author = "Support Agent") => {
    await worklogMutation({ variables: { id: ticketId, comment: { id: `wl-${Date.now()}`, comment: commentText, createdAt: new Date().toISOString(), status: "Completed", author } } });
    await refetch();
  }, [refetch, worklogMutation]);

  return { tickets, getTicketById, addTicket, updateTicket, addWorklog, loading, error, refetch };
}

function mapTicket(ticket: ServerTicket): Ticket {
  return {
    id: String(ticket.id), ticketNumber: String(ticket.ticketNumber), email: ticket.customerEmail ?? "",
    customerId: ticket.customerId ?? undefined, contactType: normalizeContact(ticket.contactType ?? ticket.source),
    category: (ticket.category ?? "general_inquiry") as TicketCategoryKey, orderNumber: ticket.orderNumber ?? undefined,
    priority: normalizePriority(ticket.priority), status: normalizeStatus(ticket.status), assignedTo: ticket.assignee ?? "Queue",
    createdBy: ticket.createdBy ?? "Unknown", subject: ticket.subject ?? "", message: ticket.message ?? "",
    solution: ticket.solution ?? undefined, timeSpentOnTicket: ticket.timeSpentOnTicket ?? undefined,
    createdAt: ticket.createdAt ?? new Date(0).toISOString(), lastModifiedAt: ticket.lastModifiedAt ?? undefined,
    resolutionDate: ticket.resolutionDate ?? undefined, comments: ticket.comments ?? [], attachments: ticket.attachments ?? [],
    history: (ticket.history ?? []).map((entry: ServerTicket) => ({
      id: entry.id ?? `history-${ticket.id ?? ticket.ticketNumber ?? "ticket"}`,
      ticketNumber: entry.ticketNumber ?? ticket.ticketNumber ?? "",
      operationDate: entry.createdAt ?? ticket.createdAt ?? new Date(0).toISOString(),
      reason: entry.message ?? entry.subject ?? "Ticket update",
      solution: entry.solution,
      status: normalizeStatus(entry.status),
      priority: normalizePriority(entry.priority),
      assignedTo: entry.assignee ?? ticket.assignee ?? "Queue",
      worklog: entry.timeSpentOnTicket,
      timeSpent: entry.timeSpentOnTicket,
    })),
  };
}
function normalizeStatus(value: unknown): TicketStatus { const key = String(value ?? "open").toLowerCase().replace(/[_-]/g, " "); return ({ open: "Open", "in progress": "In Progress", waiting: "Pending", pending: "Pending", resolved: "Resolved", closed: "Closed" } as Record<string, TicketStatus>)[key] ?? "Open"; }
function normalizePriority(value: unknown): TicketPriority { const key = String(value ?? "medium").toLowerCase(); return ({ low: "Low", normal: "Medium", medium: "Medium", high: "High", urgent: "Urgent" } as Record<string, TicketPriority>)[key] ?? "Medium"; }
function normalizeContact(value: unknown) { const normalized = String(value ?? "Email"); return (["Email", "Phone", "Chat", "Web", "Social"].find((item) => item.toLowerCase() === normalized.toLowerCase()) ?? "Email") as Ticket["contactType"]; }
