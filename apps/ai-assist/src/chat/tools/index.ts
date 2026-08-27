/**
 * Assembles the full tool set exposed to the LLM for a single /chat request.
 *
 * Tools are grouped by domain — commerce (orders/carts/returns), UI (approval
 * cards, ui-state updates), and tickets — and merged into one `ToolSet`. The set
 * is rebuilt per request rather than shared, because it closes over a
 * request-scoped approval gate (below) that must not leak between requests.
 */

import type { ToolSet } from "ai";
import { buildCommerceTools } from "./commerce.js";
import { buildUiTools } from "./ui-tools.js";
import { buildTicketTools } from "./tickets.js";

/**
 * Builds the per-request tool set.
 *
 * The approval gate is the mechanism that stops the model from performing a
 * write in the same breath as showing the human its approval card. It is fresh
 * (`pending: false`) for every request. `action_approval.execute` flips it to
 * `true`; the write tools (`create_ticket` / `update_ticket`) read it and return
 * a blocking error while it is set, so a write cannot land in the same agentic
 * step that surfaced the approval card. (The separate `stopWhen` guard in
 * routes/chat.ts covers the cross-step case.)
 */
export function buildChatTools(): ToolSet {
  const approvalGate = { pending: false };

  return {
    ...buildCommerceTools(),
    ...buildUiTools(approvalGate),
    ...(buildTicketTools(approvalGate) as ToolSet)
  };
}
