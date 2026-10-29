/**
 * Server-side guard for every assistant tool that changes data.
 *
 * Write tools used to rely on the model following the prompt and on the studio
 * UI. These checks run in code, on every call, whatever the model was told:
 *  - permission: the rep's role (from trusted headers) must allow the write;
 *  - approval (for everything except draft cart edits): the rep's CURRENT
 *    message must be an approval — `SystemPromptContext.approval`, derived from
 *    the message itself in routes/chat.ts, never from the model — and no
 *    approval card may have been shown earlier in this same turn (the
 *    per-request approval gate). A `return.confirm` authorises start_return for
 *    the order it names, nothing else.
 *
 * Writes that don't go through these tools are unaffected: the rep's own
 * clicks on CRM card buttons write directly, and the public voice agent creates
 * its handoff ticket through its own server-side path with its own checks.
 */

import { createLogger } from "@csa/logger";
import { getSystemPromptContext } from "../system-prompt.js";

const log = createLogger("ai-assist").child({ module: "tools/write-guard" });

type WritePermission =
  | "canCreateCarts"
  | "canUpdateCarts"
  | "canCreateOrders"
  | "canUpdateOrders"
  | "canCreateTickets"
  | "canUpdateTickets"
  | "canUpdateCustomers";

type WriteRule = {
  permission: WritePermission;
  approval: "none" | "approval_card" | "approval_card_or_return_confirm";
};

/** One rule per write tool. A tool missing here is a read and passes through untouched. */
const WRITE_RULES: Record<string, WriteRule> = {
  // Draft cart edits — reversible, nothing ships or charges, so permission only.
  create_cart: { permission: "canCreateCarts", approval: "none" },
  add_to_cart: { permission: "canUpdateCarts", approval: "none" },
  remove_from_cart: { permission: "canUpdateCarts", approval: "none" },
  change_cart_quantity: { permission: "canUpdateCarts", approval: "none" },
  apply_discount_code: { permission: "canUpdateCarts", approval: "none" },
  remove_discount_code: { permission: "canUpdateCarts", approval: "none" },
  delete_cart: { permission: "canUpdateCarts", approval: "approval_card" },
  update_cart_address: { permission: "canUpdateCarts", approval: "none" },
  update_cart_shipping_method: { permission: "canUpdateCarts", approval: "none" },
  // Orders
  place_order: { permission: "canCreateOrders", approval: "approval_card" },
  cancel_order: { permission: "canUpdateOrders", approval: "approval_card" },
  start_return: { permission: "canUpdateOrders", approval: "approval_card_or_return_confirm" },
  update_order: { permission: "canUpdateOrders", approval: "approval_card" },
  // Tickets
  create_ticket: { permission: "canCreateTickets", approval: "approval_card" },
  update_ticket: { permission: "canUpdateTickets", approval: "approval_card" },
  add_ticket_note: { permission: "canUpdateTickets", approval: "approval_card" },
  // CRM
  log_crm_activity: { permission: "canUpdateCustomers", approval: "approval_card" },
  update_crm_activity: { permission: "canUpdateCustomers", approval: "approval_card" },
  update_crm_contact: { permission: "canUpdateCustomers", approval: "approval_card" },
  // Customer addresses (commerce customer record)
  add_customer_address: { permission: "canUpdateCustomers", approval: "approval_card" },
  update_customer_address: { permission: "canUpdateCustomers", approval: "approval_card" },
  remove_customer_address: { permission: "canUpdateCustomers", approval: "approval_card" },
  set_default_customer_address: { permission: "canUpdateCustomers", approval: "approval_card" },
  // Wrap-up runs ticket and CRM writes; each step re-checks its own permission.
  wrap_up_case: { permission: "canUpdateTickets", approval: "approval_card" }
};

const WRITE_DENIED =
  "PERMISSION DENIED: your role can't make this change. Please reach out to the admin to perform write or update actions.";

const APPROVAL_GATE_ERROR =
  "APPROVAL_GATE_BLOCKED: An action_approval confirmation card was shown earlier in this turn. " +
  "You must NOT call a write tool until the agent explicitly clicks Approve in the UI. " +
  "Stop your response now and wait for the next user message.";

function approvalRequiredError(toolName: string) {
  return (
    `APPROVAL_REQUIRED: ${toolName} changes real data and needs the rep's approval first, and the rep's current message is not an approval. ` +
    "Call action_approval in THIS reply describing exactly what will change — a text description is not enough, the rep can only approve " +
    "by clicking the card — then stop. Run it only after the rep's next message is an [approved-action]."
  );
}

type AnyTool = { execute?: (...args: never[]) => unknown };

function guardWrite<T extends AnyTool>(name: string, rule: WriteRule, original: T, approvalGate?: { pending: boolean }): T {
  const execute = original.execute as ((...args: unknown[]) => unknown) | undefined;
  if (!execute) return original;
  return {
    ...original,
    execute: async (...args: unknown[]) => {
      const ctx = getSystemPromptContext();
      if (!ctx[rule.permission]) {
        log.info(`write:${name}`, { ok: false, blocked: "permission" });
        return { error: WRITE_DENIED };
      }
      if (rule.approval !== "none") {
        if (approvalGate?.pending) return { error: APPROVAL_GATE_ERROR };
        const approval = ctx.approval;
        const input = (args[0] ?? {}) as { orderId?: unknown };
        const approved =
          approval?.kind === "approval_card" ||
          (rule.approval === "approval_card_or_return_confirm" &&
            approval?.kind === "return_confirm" &&
            approval.orderId === input.orderId);
        if (!approved) {
          log.info(`write:${name}`, { ok: false, blocked: "approval" });
          return { error: approvalRequiredError(name) };
        }
      }
      return execute(...args);
    }
  } as T;
}

/**
 * Returns a copy of `tools` with every write tool (any name in WRITE_RULES)
 * wrapped in its guard. Read tools are passed through unchanged, and the
 * originals are never modified — tool sets are rebuilt per request.
 */
export function guardWriteTools<T extends Record<string, unknown>>(tools: T, approvalGate?: { pending: boolean }): T {
  const guarded: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(tools)) {
    const rule = WRITE_RULES[name];
    guarded[name] = rule ? guardWrite(name, rule, value as AnyTool, approvalGate) : value;
  }
  return guarded as T;
}
