import { createLogger } from "@csa/logger";
import { aiFollowupEnabled } from "./information-request.js";
import { localEmailConfig } from "./config.js";
import { sendTicketCreated } from "./ticket-created.js";
import type { Ticket } from "../tickets/types.js";

const log = createLogger("ticketing-email");
/** Local synchronous orchestration: ticket persistence succeeds even if AI is unavailable. */
export async function analyzeCreatedTicket(ticket: Ticket, identity: { clientId?: string; userEmail?: string; userRole?: string }) {
  if (!aiFollowupEnabled() || ticket.id.startsWith("zendesk:") || ticket.id.startsWith("freshdesk:")) return;
  if (!identity.clientId || !identity.userEmail || !["agent", "admin", "superadmin"].includes(identity.userRole ?? "")) return;
  try {
    const response = await fetch(`${process.env.AI_ASSIST_URL ?? "http://localhost:8080"}/ticket-review`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csa-client-id": identity.clientId, "x-csa-project-key": ticket.projectKey, "x-csa-user-email": identity.userEmail, "x-csa-user-role": identity.userRole! },
      body: JSON.stringify({ operation: "analyze", ticketId: ticket.id }),
      signal: AbortSignal.timeout(65_000)
    });
    if (!response.ok) throw new Error("Analysis unavailable");
    const { review } = await response.json() as { review?: { status: string; informationRequest?: unknown; informationRequestError?: string } };
    // No fallback send after an uncertain analysis result: the request may still be sending.
    if (review && !["analyzing", "failed"].includes(review.status) && !review.informationRequest && !review.informationRequestError) {
      await sendTicketCreated(ticket, localEmailConfig(ticket.projectKey));
    }
  } catch {
    log.warn("Ticket saved; automatic analysis unavailable. Open AI review to retry analysis before sending email.", { ticketId: ticket.id });
  }
}
