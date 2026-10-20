export type BusinessType = "b2c" | "b2b";

export interface PageContext {
  type: "customer" | "order" | "ticket" | "cart" | "product" | "businessUnit";
  id: string;
}

export interface SessionContext {
  userEmail?: string;
  userRole?: string;
  projectKey?: string;
  /** Tenant/organisation id — sent alongside projectKey so ai-assist can
   *  forward x-csa-client-id and resolve the correct multi-tenant project. */
  clientId?: string;
  businessType?: BusinessType;
  pageContext?: PageContext | null;
  proactiveHint?: string | null;
  // ACL — sent by the studio based on the authenticated user's role.
  // ai-assist defaults writes to false when these are absent.
  canViewTickets?: boolean;
  canCreateTickets?: boolean;
  canUpdateTickets?: boolean;
  canViewOrders?: boolean;
  canCreateOrders?: boolean;
  canUpdateOrders?: boolean;
  canViewCustomers?: boolean;
  canCreateCustomers?: boolean;
  canUpdateCustomers?: boolean;
  canViewCarts?: boolean;
  canCreateCarts?: boolean;
  canUpdateCarts?: boolean;
  canViewProducts?: boolean;
  /** Minimum 12-month order total (in project currency cents) to classify a customer as VIP. */
  vipThreshold?: string;
}

export interface ConversationSession {
  id: string;
  customerName: string;
  customerEmail?: string;
  topic: string;
  startedAt: Date;
  isActive: boolean;
  messageCount: number;
}

// ─── Tool argument shapes (mirror ui-tools.ts on the backend) ─────────────────

export interface UpdateUiStateArgs {
  goal: string;
  workflowStage: string;
  sentiment: "positive" | "neutral" | "concerned" | "frustrated" | "resolved";
  confidence: number;
  strategy: string;
  nextSteps: string[];
  customerId?: string;
}

/** One before → after line on an approval card. */
export interface ApprovalChange {
  label: string;
  from?: string;
  to: string;
}

/** A value the rep can adjust on the approval card before approving. */
export interface ApprovalField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select" | "date";
  value?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

export interface ActionApprovalArgs {
  actionId: string;
  title: string;
  description: string;
  intent: string;
  executeCommand: string;
  changes?: ApprovalChange[];
  steps?: string[];
  fields?: ApprovalField[];
}

/** What happened to an approval card, read from the rep's next message. */
export type ApprovalResolution = "approved" | "declined" | "superseded" | null;

export interface SuggestedActionsArgs {
  actions: Array<{ label: string; prompt: string }>;
}

export interface OrderSummaryArgs {
  orderId: string;
  orderNumber: string;
  status: string;
  date: string;
  itemCount: number;
  total: string;
  customer: { name: string; email?: string };
  shipment?: {
    status: string;
    carrier?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
  };
}

export interface OrderConfirmationArgs {
  orderId: string;
  orderNumber: string;
  customer: { name: string; email?: string };
  itemCount: number;
  total: string;
  placedAt?: string;
  paymentMethod?: string;
}

export interface CartSummaryArgs {
  cartId: string;
  cartVersion?: number;
  /** Absent when the cart has no known customer — never a placeholder. */
  customer?: { name: string; email?: string };
  itemCount: number;
  items: Array<{ sku: string; name: string; quantity: number; lineTotal: string }>;
  subtotal: string;
  discount?: string;
  shipping?: string;
  total: string;
}

export interface ProductCardArgs {
  name: string;
  sku: string;
  variantId?: string;
  /** Formatted price; empty when the product has no price in the conversation's currency. */
  price: string;
  /** "Out of stock" / "12 in stock"; absent or empty when there is no inventory record — unknown, not "in stock". */
  stock?: string;
  image?: string;
  images?: string[];
  slug?: string;
  description?: string;
  category?: string;
  variants?: Array<{
    sku: string;
    attributes?: Record<string, string>;
    price: string;
    stock: string;
    images?: string[];
  }>;
}

export interface CaseBriefingArgs {
  customerName: string;
  ticketNumber?: string;
  issueCategory: string;
  caseSummary: string;
  rootCause: string;
  sentiment: UpdateUiStateArgs["sentiment"];
  confidenceScore: number;
  relatedOrderNumber?: string;
  recommendedResolution: string;
  suggestedActions: string[];
  /** CRM contact id; when present the card shows a live CRM strip. */
  crmContactId?: string;
  /** Internal ticket id; the card then shows the ticket action buttons. */
  ticketId?: string;
}

/** crm_contact_card: only the id comes from the model; the card loads everything else live. */
/** ticket_card: only the id comes from the model; the ticket loads live. */
export interface TicketCardArgs {
  ticketId: string;
}

export interface CrmContactCardArgs {
  contactId: string;
}

export interface DraftEmailArgs {
  draftContent: string;
  suggestedSubject: string;
}

export interface RenderRefundActionArgs {
  orderId: string;
  orderNumber: string;
  reason: string;
  items: Array<{ lineItemId: string; sku: string; name: string; quantity: number }>;
}
