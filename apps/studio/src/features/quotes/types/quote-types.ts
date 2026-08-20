/**
 * Quotes Module Types
 *
 * Strongly-typed domain interfaces for B2B Quotes & Quote Negotiations.
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
}

export interface QuoteNegotiationTurn {
  id: string;
  authorRole: "Buyer" | "Seller";
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
  companyKey: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  currencyCode?: string;
  itemCount?: number;
  status: QuoteStatus;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountPct: number;
  negotiatedTotal: number;
  validUntil: string;
  createdAt: string;
  lastModifiedAt: string;
  poNumber?: string;
  negotiationTurns: QuoteNegotiationTurn[];
}

export interface QuoteFilter {
  searchText: string;
  statusFilter?: string;
  companyIdFilter?: string;
}

export interface QuoteSort {
  key: "quoteNumber" | "companyName" | "customerName" | "negotiatedTotal" | "createdAt" | "validUntil";
  order: "asc" | "desc";
}
