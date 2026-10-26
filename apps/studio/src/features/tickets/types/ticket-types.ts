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

/** As reported by the ticket provider; only "running" depends on the current time. */
export type SlaStage = "running" | "paused" | "met" | "missed" | "completed" | "unknown";

export interface SlaMetric {
  key: string;
  label: string;
  stage: SlaStage;
  dueAt?: string | null;
  completedAt?: string | null;
}

/** null on a ticket = the provider exposes no SLA data; empty metrics = no SLA policy applies. */
export interface TicketSla {
  source: string;
  nextDueAt?: string | null;
  metrics: SlaMetric[];
}

export interface Ticket {
  sla?: TicketSla | null;
  aiStatus?: string;
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
