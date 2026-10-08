import { createLogger } from "@csa/logger";
import type { Ticket } from "../tickets/types.js";
import { validateEmail, type EmailMessage, type EmailSendResult } from "@csa/email";
import type { TicketEmailService } from "./types.js";

const log = createLogger("ticketing-email");

export function ticketCreatedMessage(ticket: Ticket, service: TicketEmailService): EmailMessage {
  return {
    from: service.from,
    to: { email: validateEmail(ticket.customerEmail?.trim() || "", "Customer email") },
    replyTo: service.replyTo,
    subject: `[${ticket.ticketNumber}] ${ticket.subject.replace(/[\r\n]/g, " ")}`,
    // Descriptions and worklogs can be private agent notes. Never send them.
    text: `Hello,\n\nYour support ticket ${ticket.ticketNumber} has been created.\n\nSubject: ${ticket.subject}\n\nOur support team will review your request.\n\nCustomerSAX Support`
  };
}

/** A failed send must not turn a saved ticket into a failed create mutation. */
export async function sendTicketCreated(ticket: Ticket, service: TicketEmailService | null): Promise<EmailSendResult | { status: "skipped" }> {
  if (!service) return { status: "skipped" };
  if (!ticket.customerEmail) {
    log.warn("Ticket email skipped: no customer email", { ticketId: ticket.id });
    return { status: "skipped" };
  }
  const metadata = { ticketId: ticket.id, provider: service.provider.name };
  try {
    const result = await service.provider.send(ticketCreatedMessage(ticket, service));
    if (result.status === "accepted") {
      log.info("Ticket email accepted by provider (delivery not yet confirmed)", metadata);
    } else if (result.status === "rejected") {
      log.error("Ticket saved, but email provider rejected email", undefined, { ...metadata, status: result.statusCode });
    } else {
      log.error("Ticket saved, but email delivery is uncertain; check provider activity before retrying", undefined, metadata);
    }
    return result;
  } catch {
    log.error("Ticket saved, but email send failed or delivery is uncertain; check provider activity before retrying", undefined, metadata);
    return { status: "unknown" };
  }
}
