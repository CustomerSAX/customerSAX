export type Scope = { clientId: string; projectKey: string; userEmail: string };
type Money = { centAmount: number; currencyCode: string; fractionDigits: number };

/** Live commercetools quote request facts (quoteReviewSnapshot). Null means not recorded. */
export type QuoteSnapshot = {
  id: string;
  key: string | null;
  version: number;
  quoteRequestState: string | null;
  comment: string | null;
  createdAt: string | null;
  lastModifiedAt: string | null;
  totalPrice: Money | null;
  businessUnit: { key?: string | null; name?: string | null } | null;
  customer: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null } | null;
  shippingAddress: Record<string, string | null> | null;
  billingAddress: Record<string, string | null> | null;
  lineItems: Array<{
    id: string;
    sku: string | null;
    name: string | null;
    quantity: number;
    unitPrice: Money | null;
    totalPrice: Money | null;
  }>;
  inventory: Array<{
    sku: string;
    tracked: boolean;
    entries: Array<{ channel: string | null; availableQuantity: number }>;
  }>;
};
export type QuoteAnalysis = {
  summary: string;
  recommendation: "accept" | "reject" | "needs_information";
  reason: string;
  findings: string[];
  missingInformation: string[];
  responseDraft: string;
};
export type QuoteDecision = "Accepted" | "Rejected";
export type QuoteReviewStatus =
  | "analyzing"
  | "pending"
  | "blocked"
  | "executing"
  | "succeeded"
  | "declined"
  | "stale"
  | "failed"
  | "uncertain";
export type QuoteReview = {
  _id: string;
  clientId: string;
  projectKey: string;
  quoteId: string;
  quoteVersion: number;
  quoteState: string | null;
  quoteLastModifiedAt: string | null;
  revision: string;
  status: QuoteReviewStatus;
  summary: string;
  explanation: string;
  analysis?: QuoteAnalysis;
  action: { state: QuoteDecision; expectedVersion: number } | null;
  result?: { version: number; quoteRequestState: string };
  approvedBy?: string;
  approvedAt?: string;
  updatedAt: string;
  audit: Array<{
    at: string;
    actor: string;
    event: string;
    revision: string;
    action?: QuoteReview["action"];
  }>;
};
export interface QuoteReviewStore {
  get(id: string): Promise<QuoteReview | null>;
  insert(review: QuoteReview): Promise<boolean>;
  change(
    id: string,
    revision: string,
    statuses: QuoteReviewStatus[],
    patch: Partial<QuoteReview>,
    event: QuoteReview["audit"][number]
  ): Promise<QuoteReview | null>;
}
