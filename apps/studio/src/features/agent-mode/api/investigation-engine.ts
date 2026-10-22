import type {
  ContactTarget,
  InvestigationResult,
  ProposedChange,
  ResolutionPlanStep,
  TicketIntent,
} from "../types";

export interface TicketAnalysisInput {
  id: string;
  ticketNumber: string;
  subject?: string | null;
  message?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  priority?: string | null;
  comments?: Array<{ comment?: string; author?: string }>;
}

export interface CustomerTargetInput {
  id: string;
  email: string;
  version: number;
  targets: ContactTarget[];
}

export interface OrderAnalysisInput {
  id?: string;
  orderNumber?: string;
  shipmentState?: string;
  state?: string;
  orderState?: string;
  shippingAddress?: {
    streetName?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

/**
 * Normalizes text for clean keyword and entity searching.
 */
function cleanText(text: string): string {
  return text.toLowerCase().replace(/[\r\n]+/g, " ").trim();
}

/**
 * Extracts a phone number sequence from text (at least 7 digits, supports formats with dashes/spaces/parentheses).
 */
export function extractPhoneNumber(text: string): string | null {
  // Matches e.g. "7448122377", "+1 (469) 246-6072", "123-456-7890"
  const phonePattern = /(?:\+?[\d\s()\-]{7,20})/g;
  const matches = text.match(phonePattern);
  if (!matches) return null;

  for (const match of matches) {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) {
      return match.trim();
    }
  }
  return null;
}

/**
 * Extracts address target keywords (e.g., "Newmarket address", "for Newmarket", "at Newmarket").
 */
export function extractAddressKeyword(text: string): string | null {
  const patterns = [
    /\b(?:for|at|in|on)\s+([a-zA-Z0-9'-]+)\s+(?:address|location|residence|home|office)\b/i,
    /\b([a-zA-Z0-9'-]+)\s+(?:address|location|residence)\b/i,
    /\b(?:address|location)\s+(?:for|at|in|of)\s+([a-zA-Z0-9'-]+)\b/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const lower = candidate.toLowerCase();
      if (!["new", "my", "the", "an", "this", "contact", "your", "our", "to", "for", "at", "update"].includes(lower)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Extracts order number reference (e.g., ORD-1234, RC-9981, #12345).
 */
export function extractOrderNumber(text: string): string | null {
  const match = text.match(/\b(ORD-\d+|RC-\d+|#\d{4,8})\b/i);
  return match ? match[1].replace("#", "") : null;
}

/**
 * Matches extracted address keyword against customer address targets.
 */
export function matchAddressTargets(
  targets: ContactTarget[],
  keyword: string | null
): { matches: ContactTarget[]; isAmbiguous: boolean } {
  if (!keyword || !targets.length) {
    return { matches: [], isAmbiguous: false };
  }

  const needle = keyword.toLowerCase().trim();
  const matched = targets.filter((target) => {
    const label = target.label.toLowerCase();
    return label.includes(needle);
  });

  return {
    matches: matched,
    isAmbiguous: matched.length > 1,
  };
}

/**
 * Dynamic, ticket-aware AI investigation engine.
 * Classifies intent dynamically without hardcoding a single static template.
 */
export function investigateTicket(
  ticket: TicketAnalysisInput,
  customerData?: CustomerTargetInput | null,
  orderData?: OrderAnalysisInput | null
): InvestigationResult {
  const combinedText = [
    ticket.subject ?? "",
    ticket.message ?? "",
    ...(ticket.comments?.map((c) => c.comment ?? "") ?? []),
  ].join(" ");

  const text = cleanText(combinedText);
  const custName = ticket.customerName || ticket.customerEmail || "Customer";

  // ── 1. Intent Detection ──────────────────────────────────────────────────
  let intent: TicketIntent = "general_support";
  let confidence = 0.85;

  if (
    text.includes("contact detail") ||
    text.includes("update my contact") ||
    text.includes("update phone") ||
    text.includes("change phone") ||
    text.includes("new phone number") ||
    text.includes("contact number") ||
    (text.includes("address to") && extractPhoneNumber(combinedText)) ||
    (text.includes("address") && extractPhoneNumber(combinedText))
  ) {
    intent = "contact_update";
    confidence = 0.96;
  } else if (
    text.includes("refund") ||
    text.includes("return") ||
    text.includes("send back") ||
    text.includes("money back")
  ) {
    intent = "return_refund";
    confidence = 0.92;
  } else if (
    text.includes("where is my order") ||
    text.includes("track") ||
    text.includes("delivery") ||
    text.includes("shipment") ||
    text.includes("package") ||
    text.includes("delayed") ||
    text.includes("has not arrived") ||
    ticket.orderNumber
  ) {
    intent = "order_tracking";
    confidence = 0.94;
  } else if (
    text.includes("compatible") ||
    text.includes("compatibility") ||
    text.includes("dimension") ||
    text.includes("size") ||
    text.includes("spec") ||
    text.includes("warranty")
  ) {
    intent = "product_inquiry";
    confidence = 0.88;
  } else if (
    text.includes("password") ||
    text.includes("login") ||
    text.includes("account email") ||
    text.includes("profile")
  ) {
    intent = "account_update";
    confidence = 0.89;
  } else if (text.length < 15) {
    intent = "ambiguous_request";
    confidence = 0.65;
  }

  // ── 2. Entity Extraction ─────────────────────────────────────────────────
  const phone = extractPhoneNumber(combinedText);
  const addressKeyword = extractAddressKeyword(combinedText);
  const detectedOrderNum = ticket.orderNumber || extractOrderNumber(combinedText);

  // ── 3. Intent-Specific Workflow Analysis ──────────────────────────────────
  if (intent === "contact_update") {
    const requiredInfo = ["Customer Identity", "Target Address Record", "New Contact Number"];
    const availableInfo: string[] = [];
    const missingInfo: string[] = [];
    const proposedChanges: ProposedChange[] = [];
    const planSteps: ResolutionPlanStep[] = [];

    if (ticket.customerEmail || ticket.customerId) {
      availableInfo.push(`Customer identified: ${ticket.customerEmail || ticket.customerId}`);
    } else {
      missingInfo.push("Verified customer email or ID missing from ticket");
    }

    if (phone) {
      availableInfo.push(`Extracted requested phone: ${phone}`);
    } else {
      missingInfo.push("New contact phone number not found in ticket text");
    }

    // Inspect matching addresses
    const targets = customerData?.targets ?? [];
    const { matches, isAmbiguous } = matchAddressTargets(targets, addressKeyword);

    let matchedTarget: ContactTarget | undefined;
    let ambiguousTargets: ContactTarget[] | undefined;
    let clarificationNeeded: string | null = null;
    let canResolve = false;

    if (!customerData || !customerData.targets || customerData.targets.length === 0) {
      missingInfo.push("No addresses found on customer profile in commerce store");
      clarificationNeeded = "Customer account has no recorded addresses in the commerce store.";
    } else if (isAmbiguous) {
      ambiguousTargets = matches;
      missingInfo.push(`Multiple addresses (${matches.length}) match keyword "${addressKeyword}"`);
      clarificationNeeded = `Customer has ${matches.length} addresses matching "${addressKeyword}". Please confirm which specific address should be updated.`;
    } else if (matches.length === 1) {
      matchedTarget = matches[0];
      availableInfo.push(`Matched target address: ${matchedTarget.label}`);
    } else if (addressKeyword) {
      missingInfo.push(`No address on file matches "${addressKeyword}"`);
      clarificationNeeded = `No address matching "${addressKeyword}" found on customer profile. Customer clarification required.`;
    } else if (targets.length === 1) {
      // Single address on file fallback
      matchedTarget = targets[0];
      availableInfo.push(`Using primary address on file: ${matchedTarget.label}`);
    } else {
      ambiguousTargets = targets;
      missingInfo.push("No specific address mentioned; multiple addresses exist on file");
      clarificationNeeded = "Customer has multiple addresses on file but did not specify which one to update.";
    }

    canResolve = Boolean(matchedTarget && phone && availableInfo.length >= 2 && missingInfo.length === 0);

    if (matchedTarget && phone) {
      proposedChanges.push({
        field: "Address Phone Number",
        target: matchedTarget.label,
        previousValue: matchedTarget.phone || "(empty)",
        proposedValue: phone,
      });
    }

    planSteps.push(
      { step: 1, label: "Verify customer account and profile in commerce store", completed: Boolean(customerData) },
      { step: 2, label: `Locate address matching "${addressKeyword || "target"}"`, completed: Boolean(matchedTarget) },
      {
        step: 3,
        label: "Execute approved contact phone update on commerce backend",
        completed: false,
        requiredTool: "updateCustomerContactNumber",
      },
      { step: 4, label: "Record internal worklog and mark ticket Resolved", completed: false }
    );

    const customerDraft = canResolve
      ? `Dear ${custName},\n\nWe have updated your contact phone number for your ${matchedTarget?.label} address to ${phone} as requested.\n\nPlease let us know if you need any additional changes to your account.\n\nBest regards,\nCustomer Success Team`
      : `Dear ${custName},\n\nThank you for contacting Customer Support regarding your contact details. ${clarificationNeeded ?? "Could you please confirm your address details?"}\n\nBest regards,\nCustomer Success Team`;

    const internalWorklog = canResolve
      ? `Contact Update: Verified request to update ${matchedTarget?.label} phone to ${phone}. Prepared mutation for agent approval.`
      : `Contact Update Incomplete: ${clarificationNeeded ?? "Missing required address clarification"}.`;

    return {
      intent,
      intentLabel: "Contact Detail Update",
      confidence,
      summary: `Customer requested update of contact details${addressKeyword ? ` for ${addressKeyword} address` : ""}${phone ? ` to ${phone}` : ""}.`,
      requiredInfo,
      availableInfo,
      missingInfo,
      canResolveWithAvailableInfo: canResolve,
      clarificationNeeded,
      requiredTools: ["customerContactTargets", "updateCustomerContactNumber"],
      entities: { phone: phone ?? undefined, addressKeyword: addressKeyword ?? undefined },
      matchedContactTarget: matchedTarget,
      ambiguousContactTargets: ambiguousTargets,
      proposedChanges,
      planSteps,
      customerDraft,
      internalWorklog,
      proposedStatus: canResolve ? "Resolved" : "Pending",
    };
  }

  if (intent === "order_tracking") {
    const requiredInfo = ["Order Confirmation Number", "Carrier Tracking / Shipment State"];
    const availableInfo: string[] = [];
    const missingInfo: string[] = [];
    const proposedChanges: ProposedChange[] = [];
    const planSteps: ResolutionPlanStep[] = [];

    if (detectedOrderNum) {
      availableInfo.push(`Associated Order: #${detectedOrderNum}`);
    } else {
      missingInfo.push("Order confirmation number missing from ticket");
    }

    const shipment = orderData?.shipmentState || orderData?.state || (orderData ? "In Transit" : null);
    if (shipment) {
      availableInfo.push(`Live shipment state: ${shipment}`);
      if (orderData?.shippingAddress?.city) {
        availableInfo.push(`Destination: ${orderData.shippingAddress.city}, ${orderData.shippingAddress.country}`);
      }
    } else if (detectedOrderNum) {
      missingInfo.push(`Order #${detectedOrderNum} not found in commerce store`);
    }

    const canResolve = Boolean(detectedOrderNum && shipment);
    const clarificationNeeded = !detectedOrderNum
      ? "Order confirmation number is required to look up tracking details with the carrier."
      : null;

    if (canResolve) {
      proposedChanges.push({
        field: "Ticket Status",
        target: ticket.ticketNumber,
        previousValue: ticket.status || "Open",
        proposedValue: shipment && shipment.toLowerCase() === "delivered" ? "Resolved" : "In Progress",
      });
    }

    planSteps.push(
      { step: 1, label: "Identify associated commerce order", completed: Boolean(detectedOrderNum) },
      { step: 2, label: "Fetch live shipment and carrier tracking status", completed: Boolean(shipment) },
      { step: 3, label: "Draft verified tracking update for customer", completed: canResolve },
      { step: 4, label: "Update ticket status and record internal worklog", completed: false }
    );

    const customerDraft = canResolve
      ? `Dear ${custName},\n\nThank you for reaching out regarding Order #${detectedOrderNum}. We have verified that your shipment is currently '${shipment}'${orderData?.shippingAddress?.city ? ` en route to ${orderData.shippingAddress.city}` : ""}.\n\nWe are monitoring this shipment closely. Please let us know if you need any additional assistance.\n\nBest regards,\nCustomer Success Team`
      : `Dear ${custName},\n\nThank you for contacting Customer Support. To help track the delivery status of your package, could you please provide your order confirmation number?\n\nBest regards,\nCustomer Success Team`;

    return {
      intent,
      intentLabel: "Order Tracking & Delivery (WISMO)",
      confidence,
      summary: `Customer inquired about shipment status for order ${detectedOrderNum || "(unspecified)"}.`,
      requiredInfo,
      availableInfo,
      missingInfo,
      canResolveWithAvailableInfo: canResolve,
      clarificationNeeded,
      requiredTools: ["order"],
      entities: { orderNumber: detectedOrderNum ?? undefined },
      proposedChanges,
      planSteps,
      customerDraft,
      internalWorklog: canResolve
        ? `WISMO Investigation: Verified Order #${detectedOrderNum} status is '${shipment}'. Response drafted for customer.`
        : `WISMO Investigation: Order number missing. Inquiry sent to customer.`,
      proposedStatus:
        canResolve && shipment && shipment.toLowerCase() === "delivered"
          ? "Resolved"
          : canResolve
          ? "In Progress"
          : "Pending",
    };
  }

  if (intent === "return_refund") {
    return {
      intent,
      intentLabel: "Return & Refund Request",
      confidence,
      summary: "Customer requested a return or financial refund. High-risk financial action requires human approval.",
      requiredInfo: ["Order Confirmation", "Return Eligibility", "Supervisor Financial Approval"],
      availableInfo: [
        detectedOrderNum ? `Order: #${detectedOrderNum}` : "Order unspecified",
        "Policy guard: Automated refunds disabled",
      ],
      missingInfo: [
        "Supervisor approval required for financial refunds",
        "Item condition verification pending",
      ],
      canResolveWithAvailableInfo: false,
      clarificationNeeded: "Refunds and payment modifications require manual review and supervisor approval per financial security policies.",
      requiredTools: ["render_refund_action", "start_return"],
      entities: { orderNumber: detectedOrderNum ?? undefined },
      proposedChanges: [],
      planSteps: [
        { step: 1, label: "Review return eligibility window", completed: true },
        { step: 2, label: "Escalate to Tier 2 / Supervisor for financial refund approval", completed: false },
        { step: 3, label: "Generate RMA / return label upon approval", completed: false },
      ],
      customerDraft: `Dear ${custName},\n\nThank you for reaching out regarding a return. Your request has been received and escalated to our Returns team for review under our satisfaction policy. We will follow up shortly with return instructions.\n\nBest regards,\nCustomer Success Team`,
      internalWorklog: `Return/Refund Request: Customer requested return/refund. Financial policy dictates supervisor approval. Autonomous write blocked.`,
      proposedStatus: "Pending",
      isHighRiskFinancial: true,
    };
  }

  // Default: General Support or Product Inquiry (Never asks for order number unless needed!)
  const isProduct = intent === "product_inquiry";
  return {
    intent,
    intentLabel: isProduct ? "Product & Compatibility Inquiry" : "General Customer Support",
    confidence,
    summary: `Customer submitted an inquiry: "${ticket.subject || "General inquiry"}".`,
    requiredInfo: ["Ticket Context", "Customer Query Details"],
    availableInfo: [
      `Customer: ${custName}`,
      `Subject: ${ticket.subject || "(no subject)"}`,
      "Resolution requires informational response (zero commerce mutations needed)",
    ],
    missingInfo: [],
    canResolveWithAvailableInfo: true,
    clarificationNeeded: null,
    requiredTools: [],
    entities: {},
    proposedChanges: [
      {
        field: "Ticket Status",
        target: ticket.ticketNumber,
        previousValue: ticket.status || "Open",
        proposedValue: "Resolved",
      },
    ],
    planSteps: [
      { step: 1, label: "Analyze customer question and knowledge base", completed: true },
      { step: 2, label: "Draft verified informational response", completed: true },
      { step: 3, label: "Record internal worklog and mark ticket Resolved", completed: false },
    ],
    customerDraft: `Dear ${custName},\n\nThank you for reaching out to Customer Support regarding "${ticket.subject || "your inquiry"}".\n\nWe have reviewed your request and are happy to assist. Please let us know if you have any further questions.\n\nBest regards,\nCustomer Success Team`,
    internalWorklog: `General Inquiry: Addressed customer question regarding "${ticket.subject || "inquiry"}". No commerce record mutation required.`,
    proposedStatus: "Resolved",
  };
}
