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
  // ACL — sent by the webapp based on the authenticated user's role.
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

export interface ActionApprovalArgs {
  actionId: string;
  title: string;
  description: string;
  intent: string;
  executeCommand: string;
}

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
  customer: { name: string; email?: string };
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
  price: string;
  stock: string;
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
