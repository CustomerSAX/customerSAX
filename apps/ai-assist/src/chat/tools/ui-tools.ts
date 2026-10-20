/**
 * UI pseudo-tools — no-op server-side; the LLM calls them to drive the
 * frontend's right panel, action cards, and approval flows.
 * The client reads the tool-call *arguments* to render rich UI.
 */

import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { instrumentTools } from "./instrument.js";

const log = createLogger("ai-assist").child({ module: "tools/ui" });

// ─── Resolution reason codes ──────────────────────────────────────────────────

export const RESOLUTION_REASONS = [
  { id: "defective_product", label: "Defective Product", category: "return" },
  { id: "wrong_item", label: "Wrong Item Received", category: "return" },
  { id: "item_not_as_described", label: "Item Not As Described", category: "return" },
  { id: "damaged_in_shipping", label: "Damaged in Shipping", category: "return" },
  { id: "quality_issue", label: "Quality Issue", category: "return" },
  { id: "customer_request", label: "Customer Request", category: "cancellation" },
  { id: "found_better_price", label: "Found Better Price", category: "cancellation" },
  { id: "shipping_too_slow", label: "Shipping Too Slow", category: "cancellation" },
  { id: "duplicate_order", label: "Duplicate Order", category: "cancellation" },
  { id: "no_longer_needed", label: "No Longer Needed", category: "cancellation" },
  { id: "goodwill_gesture", label: "Goodwill Gesture", category: "refund" },
  { id: "billing_error", label: "Billing Error", category: "refund" },
  { id: "service_failure", label: "Service Failure", category: "refund" }
];

// ─── Schemas (named so execute functions can reference them) ──────────────────

const updateUiStateSchema = z.object({
  goal: z.string().describe("One-line description of what you are trying to achieve this turn"),
  workflowStage: z
    .enum([
      "greeting",
      "identifying_customer",
      "reading_order",
      "reading_ticket",
      "reading_cart",
      "reading_product",
      "composing_action",
      "awaiting_approval",
      "executing_action",
      "summarizing",
      "drafting_email",
      "knowledge_lookup",
      "closing"
    ])
    .describe("Current workflow stage"),
  sentiment: z
    .enum(["positive", "neutral", "concerned", "frustrated", "resolved"])
    .default("neutral"),
  confidence: z.number().min(0).max(100).default(80),
  strategy: z.string().describe("One sentence: approach you are taking"),
  nextSteps: z.array(z.string()).max(4).describe("Up to 4 brief next-step labels"),
  customerId: z.string().optional().describe("Customer ID if identified — locks context to this customer")
});

const draftEmailSchema = z.object({
  draftContent: z.string().describe("Full email body (HTML or plain text)"),
  suggestedSubject: z.string().describe("Suggested subject line")
});

const actionApprovalSchema = z.object({
  actionId: z.string().describe("Unique ID for this approval request"),
  title: z.string().describe("Short title shown on the card"),
  description: z.string().describe("Plain-English description of what will happen if approved"),
  intent: z
    .enum(["cancel_order", "place_order", "start_return", "process_refund", "update_order", "other"])
    .describe("Category of the action"),
  executeCommand: z.string().describe(
    "Plain-English sentence the UI will echo back as the approval signal. " +
    "MUST be human-readable — NEVER a raw tool name. " +
    "Good: 'Create the support ticket for John Doe with high priority' or 'Place the order for Jane Smith — 2 items totalling $150'. " +
    "Bad: 'create_ticket' or 'place_order'."
  ),
  changes: z
    .array(z.object({ label: z.string(), from: z.string().optional(), to: z.string() }))
    .max(8)
    .optional()
    .describe(
      "Before → after lines shown on the card, using only real values from tool results this turn, " +
      "e.g. [{label:'Order status', from:'Open', to:'Cancelled'}]. Omit 'from' for new records."
    ),
  steps: z
    .array(z.string())
    .max(5)
    .optional()
    .describe(
      "When ONE approval covers several writes, list each in order (e.g. ['Cancel order RC-1043', 'Log this to Zoho CRM']). " +
      "The rep approves them all with one click; execute every step after approval."
    ),
  fields: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(["text", "textarea", "select", "date"]).optional(),
        value: z.string().optional().describe("Pre-filled value the rep can keep or change"),
        options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
        required: z.boolean().optional()
      })
    )
    .max(5)
    .optional()
    .describe(
      "Values the rep can adjust on the card before approving (reason, note, date, summary). " +
      "Pre-fill with the best value you have; use type 'select' with options for fixed choices such as reason codes. " +
      "The approval message returns the final values as 'Values: {json}' — execute with exactly those."
    )
});

const suggestedActionsSchema = z.object({
  actions: z
    .array(z.object({ label: z.string(), prompt: z.string() }))
    .min(1)
    .max(4)
});

const productCardSchema = z.object({
  name: z.string(),
  sku: z.string(),
  variantId: z.string().optional(),
  price: z.string(),
  stock: z.string(),
  image: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  variants: z
    .array(z.object({
      sku: z.string(),
      attributes: z.record(z.string()),
      price: z.string(),
      stock: z.string()
    }))
    .optional()
});

const cartSummarySchema = z.object({
  cartId: z.string(),
  cartVersion: z.number().optional(),
  customer: z
    .object({ name: z.string(), email: z.string().optional() })
    .optional()
    .describe(
      "The cart's customer exactly as a tool result in this conversation names them. If no tool result names the customer " +
      "(e.g. view_cart shows customerId null), set name and email to empty strings — the card then shows no customer line. " +
      "Never make up a name or email."
    ),
  itemCount: z.number().int(),
  items: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    quantity: z.number().int(),
    lineTotal: z.string()
  })),
  subtotal: z.string(),
  discount: z.string().optional(),
  shipping: z.string().optional(),
  total: z.string()
});

const orderConfirmationSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customer: z.object({ name: z.string(), email: z.string().optional() }),
  itemCount: z.number().int(),
  total: z.string(),
  placedAt: z.string().optional(),
  paymentMethod: z.string().optional()
});

const orderSummarySchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  date: z.string(),
  itemCount: z.number().int(),
  total: z.string(),
  customer: z.object({ name: z.string(), email: z.string().optional() }),
  shipment: z.object({
    status: z.string(),
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    estimatedDelivery: z.string().optional()
  }).optional()
});

const renderRefundSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  reason: z.string(),
  items: z.array(z.object({
    lineItemId: z.string(),
    sku: z.string(),
    name: z.string(),
    quantity: z.number().int()
  }))
});

const getResolutionReasonsSchema = z.object({});

const caseBriefingSchema = z.object({
  customerName: z.string(),
  ticketNumber: z.string().optional(),
  issueCategory: z.string(),
  caseSummary: z.string(),
  rootCause: z.string(),
  sentiment: z.enum(["positive", "neutral", "concerned", "frustrated", "resolved"]),
  confidenceScore: z.number().min(0).max(100),
  relatedOrderNumber: z.string().optional(),
  recommendedResolution: z.string(),
  suggestedActions: z.array(z.string()).max(4),
  ticketId: z
    .string()
    .optional()
    .describe("The ticket's internal id from get_ticket (not the ticket number); the card then offers Resolve & wrap up / Edit / Add note / Draft reply"),
  crmContactId: z
    .string()
    .optional()
    .describe("CRM contact id from find_crm_contact for this customer, when one was found; the card then shows live CRM context")
});

// The ticket card loads the ticket live; only its id comes from the model.
const ticketCardSchema = z.object({
  ticketId: z.string().describe("The ticket's internal id from get_ticket / search_tickets (not the ticket number)")
});

// The card loads the contact, company, owner and follow-ups live from the CRM;
// the model passes only the id, so no CRM value is ever written by the model.
const crmContactCardSchema = z.object({
  contactId: z.string().describe("CRM contact id returned by find_crm_contact in this turn")
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

const updateUiStateTool = tool({
  description:
    "MANDATORY — call this as the VERY FIRST action on every turn before any text. Drives the right panel's intelligence view.",
  inputSchema: updateUiStateSchema,
  execute: async (_args: z.infer<typeof updateUiStateSchema>) => ({ success: true })
});

const draftEmailTool = tool({
  description: "Show a draft email for the agent to review, edit, and send to the customer.",
  inputSchema: draftEmailSchema,
  execute: async (_args: z.infer<typeof draftEmailSchema>) => ({ success: true })
});

// actionApprovalTool is constructed inside buildUiTools() so it can close over
// the per-request approvalGate.  See bottom of this file.

const suggestedActionsTool = tool({
  description: "Show 1–4 quick-action chips below the message for the agent to click.",
  inputSchema: suggestedActionsSchema,
  execute: async (_args: z.infer<typeof suggestedActionsSchema>) => ({ success: true })
});

const productCardTool = tool({
  description: "Display a product card in the conversation thread.",
  inputSchema: productCardSchema,
  execute: async (_args: z.infer<typeof productCardSchema>) => ({ success: true })
});

const cartSummaryTool = tool({
  description: "Display a cart summary card (used before placing an order).",
  inputSchema: cartSummarySchema,
  execute: async (_args: z.infer<typeof cartSummarySchema>) => ({ success: true })
});

const orderConfirmationTool = tool({
  description: "Display an order confirmation card after successfully placing an order.",
  inputSchema: orderConfirmationSchema,
  execute: async (_args: z.infer<typeof orderConfirmationSchema>) => ({ success: true })
});

const orderSummaryTool = tool({
  description:
    "Display an order summary card (status, date, items, total, payment, shipment, plus Cancel order / Start return / Reorder / Create ticket buttons).",
  inputSchema: orderSummarySchema,
  execute: async (_args: z.infer<typeof orderSummarySchema>) => ({
    success: true,
    displayed:
      "This order's card is now visible with its number, status, date, items, total, payment, shipment and action buttons. " +
      "If you are showing several orders, every one of them needs its own order_summary call — make sure each order got a card. " +
      "Several orders are shown together as one table with an Actions button per row. " +
      "Do NOT list any order fields as text, and don't say where the cards are (no 'above'/'below'). " +
      "Reply with ONE short line (e.g. '4 recent orders for Pooja Naik — 2 still open.')."
  })
});

const renderRefundActionTool = tool({
  description:
    "Display a return/refund confirmation form. Agent reviews the items and confirms to execute the return.",
  inputSchema: renderRefundSchema,
  execute: async (_args: z.infer<typeof renderRefundSchema>) => ({ success: true })
});

const getResolutionReasonsTool = tool({
  description: "Return the list of standard resolution/return reason codes to show in a picker.",
  inputSchema: getResolutionReasonsSchema,
  execute: async (_args: z.infer<typeof getResolutionReasonsSchema>) => ({
    reasons: RESOLUTION_REASONS
  })
});

const caseBriefingCardTool = tool({
  description:
    "Display a structured case briefing card in the right panel — used after initial case assessment.",
  inputSchema: caseBriefingSchema,
  execute: async (_args: z.infer<typeof caseBriefingSchema>) => ({ success: true })
});

const ticketCardTool = tool({
  description:
    "Display a live ticket card (number, subject, status, priority, customer, assignee, last update) with Resolve & wrap up / Edit / Add note / Draft reply buttons.",
  inputSchema: ticketCardSchema,
  execute: async (_args: z.infer<typeof ticketCardSchema>) => ({
    success: true,
    displayed:
      "The ticket card is now visible with its number, subject, status, priority, customer, assignee and action buttons. " +
      "Several tickets are shown together as one table with an Actions button per row — make sure each ticket in a list got its own ticket_card call. " +
      "Do NOT restate those fields as text or as bullet points. Reply with ONE short line."
  })
});

const crmContactCardTool = tool({
  description:
    "Display a live CRM contact card (contact, company, account owner, follow-up count, last activity, Open in CRM / Log call / Add follow-up buttons) together with an actionable list of the contact's open follow-ups (Mark done / Reschedule / Log update / Draft email on each).",
  inputSchema: crmContactCardSchema,
  execute: async (_args: z.infer<typeof crmContactCardSchema>) => ({
    success: true,
    displayed:
      "The CRM card is now visible to the rep with the contact's name, title, company, account owner, email, phone and last activity, " +
      "and above it a list of every open follow-up (overdue first) with Mark done / Reschedule / Log update / Draft email buttons. " +
      "Do NOT repeat any of that as text or bullets. Reply with ONE summary line built from get_crm_contact_details, e.g. " +
      "'Rachel Baker has 2 open follow-ups — 1 overdue (Confirm delivery slot, due 5 Oct).' or 'Nothing pending for Jane Smith.'"
  })
});

// ─── Export ───────────────────────────────────────────────────────────────────
//
// approvalGate is a per-request shared flag.  When action_approval.execute
// sets it to true, any write tool (create_ticket, update_ticket, place_order)
// that checks the gate in the SAME agentic step will be blocked, preventing
// the ticket/order from being created before the agent clicks Approve.

export function buildUiTools(approvalGate: { pending: boolean }) {
  // Built here (not at module level) so execute can close over approvalGate.
  const actionApprovalTool = tool({
    description:
      "Request explicit agent approval before executing a write operation. Show a confirmation card with full details.",
    inputSchema: actionApprovalSchema,
    execute: async (_args: z.infer<typeof actionApprovalSchema>) => {
      // Set the gate — any write tool called later in this same step will see
      // pending === true and return a blocking error instead of executing.
      approvalGate.pending = true;
      return {
        status: "PENDING_APPROVAL",
        message:
          "The approval card has been displayed to the agent. " +
          "STOP IMMEDIATELY — do NOT call create_ticket, update_ticket, place_order, " +
          "or any other write tool in this turn. " +
          "End your response now. " +
          "The write action will only execute in the NEXT user turn after the agent clicks Approve.",
      };
    },
  });

  return instrumentTools({
    update_ui_state: updateUiStateTool,
    draft_email: draftEmailTool,
    action_approval: actionApprovalTool,
    suggested_actions: suggestedActionsTool,
    product_card: productCardTool,
    cart_summary: cartSummaryTool,
    order_confirmation: orderConfirmationTool,
    order_summary: orderSummaryTool,
    render_refund_action: renderRefundActionTool,
    get_resolution_reasons: getResolutionReasonsTool,
    case_briefing_card: caseBriefingCardTool,
    crm_contact_card: crmContactCardTool,
    ticket_card: ticketCardTool
  }, log);
}
