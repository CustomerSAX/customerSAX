import type {
  InformationRequest,
  Ticket,
  TicketDraft,
  TicketListArgs,
  TicketPage,
  TicketUpdate,
  WorklogComment
} from "../tickets/types.js";

/** Shared port for native storage and external ticketing APIs. */
export type ProviderField = { id: string; label: string; type: string; value: string | null; editable?: boolean; rawValue?: string; options?: Array<{ label: string; value: string }> };

/** Expensive provider enrichments requested by the current GraphQL selection. */
export type TicketListOptions = { includeSla?: boolean };

export interface TicketingProvider {
  updateFields?(id: string, expectedLastModifiedAt: string, fields: Array<{ id: string; value: string }>): Promise<ProviderField[]>;
  requestInformation?(id: string, expectedLastModifiedAt: string, questions: string[]): Promise<InformationRequest | null>;
  closeIfUnchanged?(id: string, expectedLastModifiedAt: string, solution: string): Promise<Ticket | null>;
  getFields?(id: string): Promise<ProviderField[]>;
  getTicket(id: string): Promise<Ticket | null>;
  listTickets(args: TicketListArgs, options?: TicketListOptions): Promise<TicketPage>;
  createTicket(draft: TicketDraft): Promise<Ticket>;
  updateTicket(id: string, patch: TicketUpdate): Promise<Ticket | null>;
  addWorklog(id: string, comment: WorklogComment): Promise<Ticket | null>;
}
