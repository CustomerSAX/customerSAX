/**
 * Module 3: Commitments ("The Territory Promise Keeper") - Domain Types
 * Strongly typed contracts for tracking, fulfilling, and safeguarding promises made to customers.
 */

export type CommitmentStatus = "Open" | "In Progress" | "Fulfilled" | "Blocked" | "Overdue";

export type CommitmentUrgency = "overdue" | "today" | "this_week" | "later" | "completed";

export type CommitmentCategory =
  | "submittal_spec"    // Technical documentation, CAD, spec sheets
  | "stock_reservation" // Verifying branch inventory or reserving stock
  | "pricing_quote"     // Custom pricing breakdown or revised quote
  | "logistics_tracking"// Delivery window confirmation or tracking number
  | "billing_credit"    // RMA credit memo or invoice correction
  | "sample_shipment";  // Product sample delivery to jobsite

export interface CommitmentContact {
  name: string;
  role: string;
  phone: string;
  email: string;
  avatarInitials: string;
}

export interface CommitmentItem {
  id: string;
  accountId: string;
  accountName: string;
  industry: string;
  
  // The promise core
  title: string;
  details?: string;
  category: CommitmentCategory;
  categoryLabel: string;
  
  // Ownership & Stakeholder
  ownerName: string;
  ownerRole: string;
  contact: CommitmentContact;
  
  // Timing & Status
  dueDate: string;          // e.g. "Today · 2:00 PM" or "Oct 17, 2026"
  dueTimestamp: string;     // ISO or formatted
  urgency: CommitmentUrgency;
  status: CommitmentStatus;
  
  // Dependencies & Cross-Stack Links
  dependency?: string;      // e.g. "Waiting on Engineering submittal review"
  linkedRecord?: {
    type: "quote" | "order" | "service_case";
    reference: string;
  };
  
  // History & Fulfillment
  createdAt: string;
  fulfilledAt?: string;
  fulfillmentNote?: string;

  // 1-Click Quick Action (specific action button for field use)
  quickAction?: {
    label: string;       // e.g. "Send Tracking Link"
    icon: string;        // Lucide icon name
    confirmToast: string; // What to show after action completes
  };
}

export interface CommitmentFilterState {
  searchQuery: string;
  statusFilter: "all" | CommitmentStatus;
  urgencyFilter: "all" | CommitmentUrgency;
  accountFilter: string; // "all" or specific accountId
  ownerFilter: string;   // "all" or specific owner
}
