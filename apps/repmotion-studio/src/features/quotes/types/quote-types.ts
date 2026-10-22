/**
 * Quotes Module Types - Shared Contract with Customer CX Studio
 * Strongly-typed domain interfaces for B2B Quotes, Line Items & Approvals.
 */

export type QuoteStatus =
  | "Draft"
  | "Submitted"
  | "In Review"
  | "Accepted"
  | "Approved"
  | "Rejected"
  | "Declined"
  | "Cancelled"
  | "Converted";

export interface QuoteLineItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  listPrice: number;
  negotiatedPrice: number;
  subtotal: number;
  stockStatus?: "In Stock" | "Low Stock" | "Backordered" | "Allocated";
  availableBranch?: string;
}

export interface QuoteNegotiationTurn {
  id: string;
  authorRole: "Buyer" | "Seller" | "Manager";
  authorName: string;
  comment: string;
  offeredSubtotal?: number;
  timestamp: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  companyId: string;
  companyName: string;
  companyKey?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  currencyCode?: string;
  itemCount?: number;
  status: QuoteStatus;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountPct: number;
  negotiatedTotal: number;
  validUntil: string;
  createdAt: string;
  lastModifiedAt?: string;
  unblockedReason?: string;
  approvalStatus?: "None" | "Pending Manager Approval" | "Approved" | "Declined";
  negotiationTurns?: QuoteNegotiationTurn[];
}
