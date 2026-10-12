import { validateEmail } from "@csa/email";
import { localEmailConfig } from "./config.js";
import { claimInformationRequest, finishInformationRequest, getTicket, type NativeTicketScope } from "../tickets/repository.js";
import type { InformationRequest } from "../tickets/types.js";

// AI selects missing fields; it cannot choose recipients, URLs, or arbitrary mail text.
const questions: Record<string, string> = {
  new_phone_number: "What is your new phone number, including the country code?",
  clarify_request: "Could you describe the change or help you need in a little more detail?",
  missing_items: "Which items are missing from your order, and what quantity of each is missing?",
  shipping_address: "What is the complete new shipping address, including street, city, postal code, and country?"
};
export function aiFollowupEnabled() {
  return process.env.TICKET_EMAIL_ENABLED === "true" && process.env.TICKET_EMAIL_AI_FOLLOWUP_ENABLED !== "false";
}

export async function requestTicketInformation(id: string, expectedLastModifiedAt: string, keys: string[], projectKey: string, scope: NativeTicketScope): Promise<InformationRequest | null> {
  if (!aiFollowupEnabled()) return null;
  const config = localEmailConfig(projectKey);
  if (!config) return null;
  const selected = [...new Set(keys)];
  if (!selected.length || selected.length > 4 || selected.some(key => !Object.hasOwn(questions, key))) throw new Error("Unsupported customer question");
  const ticket = await getTicket(id, projectKey, scope);
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.informationRequest) return ticket.informationRequest;
  if (["closed", "resolved"].includes(ticket.status.toLowerCase())) return null;
  if (ticket.lastModifiedAt !== expectedLastModifiedAt) throw new Error("Ticket changed before email could be sent");
  if (!ticket.customerEmail?.trim()) return null;
  const recipient = validateEmail(ticket.customerEmail.trim(), "Customer email");
  const request: InformationRequest = {
    status: "sending", recipient, createdAt: new Date().toISOString(),
    subject: `Additional information needed — ${ticket.ticketNumber}`,
    text: `Hello,\n\nWe need a few details to help with your support ticket ${ticket.ticketNumber}:\n\n${selected.map(key => `• ${questions[key]}`).join("\n")}\n\nPlease reply to this email with those details. Do not include passwords, verification codes, or payment-card details.\n\nCustomerSAX Support`
  };
  if (!(await claimInformationRequest(ticket, request, scope))) return (await getTicket(id, projectKey, scope))?.informationRequest ?? null;
  // After a crash/timeout the saved claim prevents automatic repeat sends.
  let result;
  try {
    result = await config.provider.send({ from: config.from, replyTo: config.replyTo, to: { email: recipient }, subject: request.subject, text: request.text });
  } catch { result = { status: "unknown" as const }; }
  const completed: InformationRequest = { ...request, status: result.status, ...(result.status === "accepted" ? { messageId: result.messageId } : {}) };
  await finishInformationRequest(ticket, completed, scope);
  return completed;
}
