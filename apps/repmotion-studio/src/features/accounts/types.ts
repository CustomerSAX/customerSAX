/**
 * Module 2: Accounts (Account 360 & Pre-Call Intelligence) - Domain Types
 * Strongly typed contracts for the Sales Representative account portfolio and 360 cockpit.
 */

export type AccountTier = "Enterprise" | "Strategic" | "Core";
export type AccountHealthStatus = "Healthy" | "Attention Needed" | "At Risk" | "Service Hold";

export interface AccountContact {
  id: string;
  name: string;
  role: string;
  title: string;
  phone: string;
  email: string;
  isPrimary?: boolean;
  avatarInitials: string;
}

export interface AccountOrder {
  id: string;
  orderNumber: string;
  type: string;
  amount: number;
  currency: string;
  orderState: string;
  shipmentState: "Delivered" | "Shipped" | "In Transit" | "Preparing" | "Exception";
  orderDate: string;
  lineItemCount: number;
  deliveryAddress: string;
}

export interface AccountQuote {
  id: string;
  quoteNumber: string;
  title: string;
  totalAmount: number;
  discountPct: number;
  marginPct: number;
  status: "Draft" | "Submitted" | "In Review" | "Approved" | "Ready to Send" | "Expired";
  validUntil: string;
  lineItems: Array<{
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export interface AccountDigitalSignal {
  hasActiveCart: boolean;
  activeCartTotal?: number;
  activeCartItemCount?: number;
  lastPortalVisit: string;
  recentlyViewedCategories: string[];
  abandonedQuote?: {
    quoteNumber: string;
    value: number;
    abandonedDaysAgo: number;
  };
}

export interface AccountServiceCase {
  id: string;
  caseNumber: string;
  subject: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  assignedSpecialist: string;
  openedDate: string;
  resolvedDate?: string;
  resolutionNote?: string;
  blocksSalesOutreach: boolean;
  blockReason?: string;
}

export interface AccountConversationPlan {
  meetingObjective: string;
  openWith: string;
  keyQuestionsToAsk: string[];
  discussionTopics: string[];
  topicsToAvoid: string[];
  recommendedNextStep: string;
  isApproved: boolean;
}

export interface Account360 {
  id: string;
  name: string;
  tier: AccountTier;
  industry: string;
  region: string;
  headquarters: string;
  accountManager: string;
  
  // High-level Metrics
  annualSpend: number;
  spendTrendPct: number; // e.g. +14% or -8%
  healthScore: number;   // 0 - 100
  healthStatus: AccountHealthStatus;
  openOrdersCount: number;
  openQuotesValue: number;
  deliveryReliabilityPct: number;
  
  // Detailed Connected Contexts
  contacts: AccountContact[];
  conversationPlan: AccountConversationPlan;
  orders: AccountOrder[];
  quotes: AccountQuote[];
  digitalSignals: AccountDigitalSignal;
  serviceCases: AccountServiceCase[];
  evidenceHistory: Array<{
    title: string;
    detail: string;
    timestamp: string;
    source: string;
  }>;
}
