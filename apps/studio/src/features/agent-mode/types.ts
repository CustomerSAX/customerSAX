export type TaskType = "ticket" | "order" | "quote";

export type TaskUrgencyLevel = "urgent" | "high" | "normal" | "low";

export interface AgentTask {
  id: string;
  type: TaskType;
  referenceNumber: string;
  title: string;
  subtitle?: string;
  customerName?: string;
  customerEmail?: string;
  customerId?: string;
  status: string;
  priority?: TaskUrgencyLevel;
  urgencyReason: string;
  orderNumber?: string;
  totalPrice?: string;
  createdAt?: string;
  lastModifiedAt?: string;
  rawRecord: unknown;
}

export type QueueFilterTab = "all" | "tickets" | "orders" | "quotes";

export type TicketIntent =
  | "contact_update"
  | "order_tracking"
  | "return_refund"
  | "product_inquiry"
  | "account_update"
  | "general_support"
  | "ambiguous_request";

export interface ContactTarget {
  id: string;
  label: string;
  phone: string;
}

export interface ProposedChange {
  field: string;
  target: string;
  previousValue: string;
  proposedValue: string;
}

export interface ResolutionPlanStep {
  step: number;
  label: string;
  completed: boolean;
  requiredTool?: string;
}

export interface InvestigationResult {
  intent: TicketIntent;
  intentLabel: string;
  confidence: number;
  summary: string;
  requiredInfo: string[];
  availableInfo: string[];
  missingInfo: string[];
  canResolveWithAvailableInfo: boolean;
  clarificationNeeded: string | null;
  requiredTools: string[];
  entities: {
    phone?: string;
    addressKeyword?: string;
    orderNumber?: string;
    productName?: string;
  };
  matchedContactTarget?: ContactTarget;
  ambiguousContactTargets?: ContactTarget[];
  proposedChanges: ProposedChange[];
  planSteps: ResolutionPlanStep[];
  customerDraft: string;
  internalWorklog: string;
  proposedStatus: string;
  isHighRiskFinancial?: boolean;
}
