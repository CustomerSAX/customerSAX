export type CustomerQuestion = "new_phone_number" | "clarify_request" | "missing_items" | "shipping_address";
export type InformationRequest = { status: string; recipient: string; subject: string; text: string; createdAt: string; messageId?: string };
export type Scope = { clientId: string; projectKey: string; userEmail: string };
export type ReviewTicket = {
  informationRequest?: InformationRequest | null;
  id: string;
  subject: string;
  message: string;
  customerId?: string | null;
  customerEmail: string;
  lastModifiedAt?: string | null;
  status: string;
  category?: string | null;
  orderNumber?: string | null;
};
export type ReviewOrder = {
  id: string;
  version?: number;
  customerId?: string | null;
  customerEmail?: string | null;
  orderNumber?: string | null;
  lastModifiedAt?: string | null;
  [key: string]: unknown;
};
export type OrderFindings = {
  customerQuestions?: CustomerQuestion[];
  summary: string;
  actions: string[];
  responseDraft: string;
  missingInformation: string[];
  requestedAction?: "cancel_order" | "change_shipping_address" | null;
  address?: Record<string, string> | null;
};
export type OrderAction = {
  kind: "cancel_order" | "change_shipping_address";
  address?: Record<string, string>;
};
export type ContactTarget = { id: string; label: string; phone: string };
export type ContactCustomer = {
  id: string;
  email: string;
  version: number;
  targets: ContactTarget[];
};
export type Analysis = {
  customerQuestions?: CustomerQuestion[];
  summary: string;
  intent: "update_contact_number" | "unsupported" | "needs_information";
  phone: string | null;
  evidence: string | null;
  explanation: string;
};
export type ContactAction = {
  customerId: string;
  customerEmail: string;
  addressId: string;
  addressLabel: string;
  expectedVersion: number;
  previousPhone: string;
  phone: string;
};
export type ReviewStatus =
  | "analyzing"
  | "pending"
  | "blocked"
  | "executing"
  | "succeeded"
  | "closing"
  | "closed"
  | "kept_open"
  | "close_stale"
  | "close_uncertain"
  | "declined"
  | "stale"
  | "failed"
  | "uncertain";
export type Review = {
  informationRequest?: InformationRequest | null;
  informationRequestError?: string;
  _id: string;
  clientId: string;
  projectKey: string;
  ticketId: string;
  fingerprint: string;
  revision: string;
  status: ReviewStatus;
  summary: string;
  explanation: string;
  action: ContactAction | null;
  targets: ContactTarget[];
  updatedAt: string;
  orderProposal?: OrderFindings & {
    orderId: string;
    orderNumber: string;
    fingerprint: string;
    previousAddress?: Record<string, unknown>;
  };
  findingsApproved?: boolean;
  orderAction?: OrderAction;
  orderResult?: { id: string; version: number };
  approvedBy?: string;
  approvedAt?: string;
  closeApprovedBy?: string;
  closeApprovedAt?: string;
  resolutionDraft?: string;
  resolutionNotes?: string;
  result?: { version: number; phone: string };
  audit: Array<{
    at: string;
    actor: string;
    event: string;
    revision: string;
    action?: ContactAction | null;
    orderAction?: OrderAction;
    resolutionNotes?: string;
  }>;
};
export interface ReviewStore {
  get(id: string): Promise<Review | null>;
  insert(review: Review): Promise<boolean>;
  change(
    id: string,
    revision: string,
    statuses: ReviewStatus[],
    patch: Partial<Review>,
    event: Review["audit"][number]
  ): Promise<Review | null>;
}
