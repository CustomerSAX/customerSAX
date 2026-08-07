import type { ToolSet } from "ai";
import { buildCommerceTools } from "./commerce.js";
import { buildUiTools } from "./ui-tools.js";
import { buildTicketTools } from "./tickets.js";

export function buildChatTools(): ToolSet {
  return {
    ...buildCommerceTools(),
    ...buildUiTools(),
    ...(buildTicketTools() as ToolSet)
  };
}
