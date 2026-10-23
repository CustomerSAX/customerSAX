/**
 * CustomerSAX Service Ticket Contracts - Shared with RepMotion
 * Allows Sales Reps to have real-time visibility into open customer defects and resolutions.
 */

export type TicketStatus = "Open" | "In Progress" | "Pending" | "Resolved" | "Closed";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type TicketCategoryKey =
  | "order_inquiry"
  | "delivery_delay"
  | "damaged_shipment"
  | "product_substitution"
  | "billing_inquiry"
  | "general_inquiry";

export interface ServiceTicket {
  id: string;
  ticketNumber: string;
  companyName: string;
  customerId?: string;
  contactName: string;
  contactEmail: string;
  orderNumber?: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategoryKey;
  subject: string;
  description: string;
  assignedTo: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  blocksSalesOutreach: boolean;
  blockReason?: string;
}
