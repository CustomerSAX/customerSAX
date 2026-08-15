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
  customer: z.object({ name: z.string(), email: z.string().optional() }),
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
  suggestedActions: z.array(z.string()).max(4)
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
  description: "Display an order summary card in the conversation or right panel.",
  inputSchema: orderSummarySchema,
  execute: async (_args: z.infer<typeof orderSummarySchema>) => ({ success: true })
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
    case_briefing_card: caseBriefingCardTool
  }, log);
}
