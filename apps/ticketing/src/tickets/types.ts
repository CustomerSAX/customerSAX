export type TicketStatus = "open" | "in-progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type Ticket = {
  assignee?: string | null;
  category?: string | null;
  createdAt?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  id: string;
  lastModifiedAt?: string | null;
  priority: string;
  projectKey: string;
  source?: string | null;
  status: string;
  subject: string;
  ticketNumber: string;
};

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
  priority?: string | null;
  projectKey?: string | null;
  source?: string | null;
  status?: string | null;
  subject: string;
};

export type TicketUpdate = Partial<Omit<TicketDraft, "projectKey">>;
