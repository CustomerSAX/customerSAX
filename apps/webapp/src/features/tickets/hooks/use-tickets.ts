"use client";

import { useState, useCallback } from "react";
import type {
  Ticket,
  TicketStatus,
  TicketCategoryKey,
  WorklogComment,
} from "../types/ticket-types";

export const TICKET_CATEGORIES: Record<TicketCategoryKey, string> = {
  order_inquiry: "Order Inquiry",
  payment_methods: "Payment Methods",
  returns_refunds: "Returns & Refunds",
  general_inquiry: "General Inquiry",
  technical_support: "Technical Support",
  account_management: "Account Management",
};

export const TICKET_WORKFLOW: Record<TicketStatus, TicketStatus[]> = {
  Open: ["Open", "In Progress", "Closed"],
  "In Progress": ["In Progress", "Pending", "Resolved", "Closed"],
  Pending: ["Pending", "In Progress", "Resolved", "Closed"],
  Resolved: ["Resolved", "In Progress", "Closed"],
  Closed: ["Closed", "Open"],
};

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: "TCK-4019",
    ticketNumber: "TCK-4019",
    email: "mia.johnson@example.com",
    customerId: "cust-101",
    contactType: "Email",
    category: "order_inquiry",
    orderNumber: "ORD-54019",
    priority: "High",
    status: "In Progress",
    assignedTo: "John Agent (john.agent@csa.com)",
    createdBy: "mia.johnson@example.com",
    subject: "Inquiry regarding shipment delay for ORD-54019",
    message: "Hello, could you please confirm when ORD-54019 will be shipped? I selected expedited delivery at checkout.",
    solution: "Contacted warehouse manager. Package was packed and assigned tracking #TRK-90081. Scheduled for carrier pickup by 4:00 PM.",
    timeSpentOnTicket: "45 mins",
    createdAt: "2026-08-06T11:20:00Z",
    lastModifiedAt: "2026-08-06T11:45:00Z",
    comments: [
      {
        id: "wl-1",
        comment: "Called warehouse logistics to check carrier dispatch schedule.",
        createdAt: "2026-08-06T11:30:00Z",
        status: "Completed",
        author: "John Agent",
      },
      {
        id: "wl-2",
        comment: "Sent email notification with tracking number to customer.",
        createdAt: "2026-08-06T11:45:00Z",
        status: "Completed",
        author: "John Agent",
      },
    ],
    attachments: [
      {
        name: "ORD-54019_Invoice.pdf",
        url: "https://example.com/attachments/ORD-54019_Invoice.pdf",
        size: "142 KB",
      },
    ],
    history: [
      {
        id: "hist-1",
        ticketNumber: "TCK-4019",
        operationDate: "2026-08-06T11:20:00Z",
        reason: "order_inquiry",
        solution: "--",
        status: "Open",
        priority: "High",
        assignedTo: "Unassigned",
        worklog: "Ticket submitted by customer via Email.",
        timeSpent: "--",
      },
      {
        id: "hist-2",
        ticketNumber: "TCK-4019",
        operationDate: "2026-08-06T11:30:00Z",
        reason: "order_inquiry",
        solution: "Contacted warehouse manager",
        status: "In Progress",
        priority: "High",
        assignedTo: "John Agent (john.agent@csa.com)",
        worklog: "Called warehouse logistics to check carrier dispatch schedule.",
        timeSpent: "10 mins",
      },
    ],
  },
  {
    id: "TCK-4020",
    ticketNumber: "TCK-4020",
    email: "alex.chen@apexdigital.com",
    customerId: "cust-102",
    contactType: "Phone",
    category: "payment_methods",
    orderNumber: "ORD-53982",
    priority: "Medium",
    status: "Resolved",
    assignedTo: "Sarah Jenkins (sarah.jenkins@csa.com)",
    createdBy: "alex.chen@apexdigital.com",
    subject: "Payment authorization retry for credit card ending 4242",
    message: "Customer called stating payment was flagged by bank. Bank confirmed fraud release.",
    solution: "Re-triggered payment gateway charge attempt successfully. Invoice paid in full.",
    timeSpentOnTicket: "20 mins",
    createdAt: "2026-08-04T14:10:00Z",
    lastModifiedAt: "2026-08-04T14:30:00Z",
    resolutionDate: "2026-08-04T14:30:00Z",
    comments: [
      {
        id: "wl-3",
        comment: "Manual payment capture executed via Stripe gateway.",
        createdAt: "2026-08-04T14:25:00Z",
        status: "Completed",
        author: "Sarah Jenkins",
      },
    ],
    attachments: [],
    history: [
      {
        id: "hist-3",
        ticketNumber: "TCK-4020",
        operationDate: "2026-08-04T14:10:00Z",
        reason: "payment_methods",
        solution: "--",
        status: "Open",
        priority: "Medium",
        assignedTo: "Sarah Jenkins",
        worklog: "Customer phone call received.",
        timeSpent: "--",
      },
      {
        id: "hist-4",
        ticketNumber: "TCK-4020",
        operationDate: "2026-08-04T14:30:00Z",
        reason: "payment_methods",
        solution: "Re-triggered payment gateway charge attempt successfully.",
        status: "Resolved",
        priority: "Medium",
        assignedTo: "Sarah Jenkins",
        worklog: "Payment processed successfully.",
        timeSpent: "20 mins",
      },
    ],
  },
  {
    id: "TCK-4021",
    ticketNumber: "TCK-4021",
    email: "sarah@williamsconsulting.io",
    customerId: "cust-103",
    contactType: "Web",
    category: "returns_refunds",
    orderNumber: "ORD-53410",
    priority: "Low",
    status: "Closed",
    assignedTo: "Support Desk",
    createdBy: "sarah@williamsconsulting.io",
    subject: "Return label request for size exchange",
    message: "Requesting return shipping label for item returned under RMA-9012.",
    solution: "Generated prepaid FedEx return label and emailed to customer.",
    timeSpentOnTicket: "15 mins",
    createdAt: "2026-07-28T09:00:00Z",
    lastModifiedAt: "2026-07-29T10:15:00Z",
    resolutionDate: "2026-07-29T10:15:00Z",
    comments: [],
    attachments: [],
    history: [],
  },
  {
    id: "TCK-4022",
    ticketNumber: "TCK-4022",
    email: "d.miller@millerlogistics.com",
    customerId: "cust-104",
    contactType: "Chat",
    category: "technical_support",
    priority: "Urgent",
    status: "Open",
    assignedTo: "Tech Support Team",
    createdBy: "d.miller@millerlogistics.com",
    subject: "API Integration authentication failure on webhook endpoint",
    message: "Customer reported HTTP 401 Unauthorized error when receiving order update webhooks.",
    solution: "",
    timeSpentOnTicket: "30 mins",
    createdAt: "2026-08-07T08:00:00Z",
    lastModifiedAt: "2026-08-07T08:30:00Z",
    comments: [
      {
        id: "wl-4",
        comment: "Investigating OAuth token expiration setting on webhook payload encoder.",
        createdAt: "2026-08-07T08:25:00Z",
        status: "In Progress",
        author: "Tech Agent",
      },
    ],
    attachments: [],
    history: [],
  },
];

export function useTicketStore() {
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);

  const getTicketById = useCallback(
    (id: string) => tickets.find((t) => t.id === id || t.ticketNumber === id),
    [tickets]
  );

  const addTicket = useCallback(
    (newTicketData: Omit<Ticket, "id" | "ticketNumber" | "createdAt" | "comments" | "history">) => {
      const num = Math.floor(4023 + Math.random() * 1000);
      const id = `TCK-${num}`;
      const newTicket: Ticket = {
        ...newTicketData,
        id,
        ticketNumber: id,
        createdAt: new Date().toISOString(),
        comments: [],
        history: [
          {
            id: `hist-${Date.now()}`,
            ticketNumber: id,
            operationDate: new Date().toISOString(),
            reason: newTicketData.category,
            solution: "",
            status: newTicketData.status,
            priority: newTicketData.priority,
            assignedTo: newTicketData.assignedTo,
            worklog: `Ticket created by ${newTicketData.createdBy}`,
            timeSpent: "--",
          },
        ],
      };
      setTickets((prev) => [newTicket, ...prev]);
      return newTicket;
    },
    []
  );

  const updateTicket = useCallback((id: string, updates: Partial<Ticket>) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== id && t.ticketNumber !== id) return t;

        const updated: Ticket = {
          ...t,
          ...updates,
          lastModifiedAt: new Date().toISOString(),
        };

        // Track history entry if status or assignee changed
        if (updates.status || updates.assignedTo || updates.solution) {
          const newHist: Ticket = {
            ...updated,
            history: [
              ...updated.history,
              {
                id: `hist-${Date.now()}`,
                ticketNumber: updated.ticketNumber,
                operationDate: new Date().toISOString(),
                reason: updated.category,
                solution: updates.solution || updated.solution || "",
                status: updated.status,
                priority: updated.priority,
                assignedTo: updated.assignedTo,
                worklog: "Ticket details updated.",
                timeSpent: updated.timeSpentOnTicket || "10 mins",
              },
            ],
          };
          return newHist;
        }

        return updated;
      })
    );
  }, []);

  const addWorklog = useCallback((ticketId: string, commentText: string, author = "Support Agent") => {
    const newWorklog: WorklogComment = {
      id: `wl-${Date.now()}`,
      comment: commentText,
      createdAt: new Date().toISOString(),
      status: "Completed",
      author,
    };
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId && t.ticketNumber !== ticketId) return t;
        return {
          ...t,
          comments: [...t.comments, newWorklog],
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  return {
    tickets,
    getTicketById,
    addTicket,
    updateTicket,
    addWorklog,
  };
}
