export type TicketStatus = "open" | "in-progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type InformationRequest = {
  status: "sending" | "accepted" | "rejected" | "unknown";
  recipient: string;
  subject: string;
  text: string;
  createdAt: string;
  messageId?: string;
};

/**
 * Where an SLA clock stands, as reported by the provider. Only "running" is
 * time-relative (on track / at risk / breached is derived from dueAt and the
 * current time by the reader); every other stage is a settled fact.
 */
export type SlaStage = "running" | "paused" | "met" | "missed" | "completed" | "unknown";
export type SlaMetric = { key: string; label: string; stage: SlaStage; dueAt?: string | null; completedAt?: string | null };
/** null on a ticket = the provider exposes no SLA data; empty metrics = no SLA policy applies. */
export type TicketSla = { source: "native" | "freshdesk" | "zendesk"; nextDueAt: string | null; metrics: SlaMetric[] };

export type Ticket = {
  sla?: TicketSla | null;
  informationRequest?: InformationRequest | null;
  assignee?: string | null;
  category?: string | null;
  createdAt?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  contactType?: string | null;
  orderNumber?: string | null;
  createdBy?: string | null;
  message?: string | null;
  solution?: string | null;
  timeSpentOnTicket?: string | null;
  resolutionDate?: string | null;
  comments: WorklogComment[];
  attachments: TicketAttachment[];
  history: TicketHistoryEntry[];
  id: string;
  lastModifiedAt?: string | null;
  priority: string;
  projectKey: string;
  source?: string | null;
  status: string;
  subject: string;
  ticketNumber: string;
};

export type WorklogComment = { id: string; comment: string; createdAt: string; status: string; author?: string | null };
export type TicketAttachment = { name: string; url: string; size?: string | null };
export type TicketHistoryEntry = { id: string; ticketNumber: string; operationDate: string; reason: string; solution?: string | null; status: string; priority: string; assignedTo: string; worklog?: string | null; timeSpent?: string | null };

export type TicketPage = {
  count: number;
  offset: number;
  results: Ticket[];
  total: number;
};

export type TicketListArgs = {
  assignee?: string | null;
  category?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  limit?: number;
  offset?: number;
  priority?: string | null;
  projectKey?: string | null;
  search?: string | null;
  sortKey?: string | null;
  sortOrder?: string | null;
  status?: string | null;
};

export type TicketDraft = {
  assignee?: string | null;
  category?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  contactType?: string | null;
  orderNumber?: string | null;
  createdBy?: string | null;
  message?: string | null;
  worklog?: string | null;
  solution?: string | null;
  timeSpentOnTicket?: string | null;
  comments?: WorklogComment[] | null;
  attachments?: TicketAttachment[] | null;
  priority?: string | null;
  projectKey?: string | null;
  source?: string | null;
  status?: string | null;
  subject: string;
};

export type TicketUpdate = Partial<Omit<TicketDraft, "projectKey">>;
