import type {
  Ticket,
  TicketDraft,
  TicketListArgs,
  TicketPage,
  TicketUpdate,
  WorklogComment
} from "../tickets/types.js";

/** Shared port for native storage and external ticketing APIs. */
export type ProviderField = { id: string; label: string; type: string; value: string | null };

export interface TicketingProvider {
  closeIfUnchanged?(id: string, expectedLastModifiedAt: string, solution: string): Promise<Ticket | null>;
  getFields?(id: string): Promise<ProviderField[]>;
  getTicket(id: string): Promise<Ticket | null>;
  listTickets(args: TicketListArgs): Promise<TicketPage>;
  createTicket(draft: TicketDraft): Promise<Ticket>;
  updateTicket(id: string, patch: TicketUpdate): Promise<Ticket | null>;
  addWorklog(id: string, comment: WorklogComment): Promise<Ticket | null>;
}
