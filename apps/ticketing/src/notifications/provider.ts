import { createLogger } from "@csa/logger";
import type { TicketingProvider } from "../providers/types.js";
import type { Ticket } from "../tickets/types.js";
import { publishTicketNotification } from "./store.js";
const log = createLogger("ticket-notifications");

export function withNotifications(provider: TicketingProvider, clientId: string): TicketingProvider {
  async function publish(ticket: Ticket | null, title: string, previousAssignee?: string | null) {
    if (!ticket) return;
    try { await publishTicketNotification(clientId, ticket, title, previousAssignee); }
    catch { log.error("Ticket saved but notification could not be recorded", undefined, { ticketId: ticket.id }); }
  }
  return {
    ...provider,
    async createTicket(draft) {
      const ticket = await provider.createTicket(draft);
      await publish(ticket, "New ticket");
      return ticket;
    },
    async updateTicket(id, patch) {
      const before = await provider.getTicket(id);
      const ticket = await provider.updateTicket(id, patch);
      if (ticket && before && JSON.stringify(ticket) !== JSON.stringify(before)) {
        const reassigned = ticket.assignee !== before.assignee;
        await publish(ticket, reassigned ? "Ticket assignment changed" : ticket.status !== before.status ? `Ticket status changed to ${ticket.status}` : "Ticket updated", reassigned ? before.assignee : undefined);
      }
      return ticket;
    },
    async addWorklog(id, comment) {
      const ticket = await provider.addWorklog(id, comment);
      await publish(ticket, "New ticket update");
      return ticket;
    },
    ...(provider.closeIfUnchanged ? { async closeIfUnchanged(id: string, expected: string, solution: string) {
      const ticket = await provider.closeIfUnchanged!(id, expected, solution);
      await publish(ticket, "Ticket closed");
      return ticket;
    } } : {}),
    ...(provider.requestInformation ? { async requestInformation(id: string, expected: string, questions: string[]) {
      const before = await provider.getTicket(id);
      const result = await provider.requestInformation!(id, expected, questions);
      if (!before?.informationRequest && result?.status === "accepted") {
        const ticket = await provider.getTicket(id);
        await publish(ticket, "Customer information requested");
      }
      return result;
    } } : {})
  };
}
