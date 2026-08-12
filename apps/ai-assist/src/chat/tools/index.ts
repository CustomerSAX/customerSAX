import type { ToolSet } from "ai";
import { buildCommerceTools } from "./commerce.js";
import { buildUiTools } from "./ui-tools.js";
import { buildTicketTools } from "./tickets.js";

export function buildChatTools(): ToolSet {
  // Per-request approval gate — reset to false on every new request.
  // action_approval.execute sets pending = true; create_ticket / update_ticket
  // check it and return a blocking error if true, preventing writes in the same
  // agentic step as the approval card display.
  const approvalGate = { pending: false };

  return {
    ...buildCommerceTools(),
    ...buildUiTools(approvalGate),
    ...(buildTicketTools(approvalGate) as ToolSet)
  };
}
