export type TicketStatus = "Open" | "In Progress" | "Pending" | "Resolved" | "Closed";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type TicketContactType = "Email" | "Phone" | "Chat" | "Web" | "Social";

export type TicketCategoryKey =
  | "order_inquiry"
  | "payment_methods"
  | "returns_refunds"
  | "general_inquiry"
  | "technical_support"
  | "account_management";

export interface WorklogComment {
  id: string;
  comment: string;
  createdAt: string;
  status: string;
  author?: string;
}

export interface TicketAttachment {
  name: string;
  url: string;
  size?: string;
}

export interface TicketHistoryEntry {
  id: string;
  ticketNumber: string;
  operationDate: string;
  reason: string;
  solution?: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string;
  worklog?: string;
  timeSpent?: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  email: string;
  customerId?: string;
  contactType: TicketContactType;
  category: TicketCategoryKey;
  orderNumber?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string;
  createdBy: string;
  subject: string;
  message: string;
  solution?: string;
  timeSpentOnTicket?: string;
  createdAt: string;
  lastModifiedAt?: string;
  resolutionDate?: string;
  comments: WorklogComment[];
  attachments: TicketAttachment[];
  history: TicketHistoryEntry[];
}

export interface TicketListFilters {
  searchOption: "ticketNumber" | "email" | "subject" | "allFields";
  searchText: string;
  status?: string;
  priority?: string;
  category?: string;
}
