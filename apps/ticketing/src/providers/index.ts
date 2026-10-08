import { withNotifications } from "../notifications/provider.js";
import { resolveProjectTicketing, nativeTicketLegacyAccess, projectFreshdeskCredentials } from "@csa/mongodb";
import { projectZendeskClient } from "../zendesk/project-client.js";
import { freshdeskProvider } from "../freshdesk/provider.js";
import * as native from "../tickets/repository.js";
import { zendeskProvider } from "../zendesk/provider.js";
import type { TicketingProvider } from "./types.js";
import { aiFollowupEnabled, requestTicketInformation } from "../email/information-request.js";
import { localEmailConfig } from "../email/config.js";
import { sendTicketCreated } from "../email/ticket-created.js";

export function ticketingProviderName(): "internal" | "zendesk" {
  const value = process.env.TICKETING_PROVIDER?.trim() || "internal";
  if (value !== "internal" && value !== "zendesk")
    throw new Error("TICKETING_PROVIDER must be internal or zendesk");
  return value;
}

export function ticketingProvider(projectKey: string): TicketingProvider {
  if (ticketingProviderName() === "zendesk") return zendeskProvider(projectKey);
  return nativeProvider(projectKey);
}

function nativeProvider(projectKey: string, scope?: native.NativeTicketScope): TicketingProvider {
  return {
    requestInformation: (id, expected, questions) => {
      if (!scope) throw new Error("An authenticated client is required for customer email");
      return requestTicketInformation(id, expected, questions, projectKey, scope);
    },
    closeIfUnchanged: (id, expectedLastModifiedAt, solution) => native.closeIfUnchanged(id, expectedLastModifiedAt, projectKey, scope, solution),
    getTicket: (id) => native.getTicket(id, projectKey, scope),
    listTickets: (args) => native.listTickets({ ...args, projectKey }, scope),
    createTicket: async (draft) => {
      const emailConfig = localEmailConfig(projectKey);
      const ticket = await native.createTicket({ ...draft, projectKey }, scope);
      if (!aiFollowupEnabled()) await sendTicketCreated(ticket, emailConfig);
      return ticket;
    },
    updateTicket: (id, patch) => native.updateTicket(id, { ...patch, projectKey }, scope),
    addWorklog: (id, comment) => native.addWorklog(id, comment, projectKey, scope)
  };
}

export async function resolveTicketing(projectKey: string, clientId?: string) {
  if (!clientId) {
    if (process.env.NODE_ENV === "production") throw new Error("An authenticated client is required for ticketing");
    return { name: ticketingProviderName(), provider: ticketingProvider(projectKey) };
  }
  const settings = await resolveProjectTicketing(clientId, projectKey);
  if (settings.provider === "internal") return {
    name: "internal", provider: withNotifications(nativeProvider(projectKey, { clientId, includeLegacy: await nativeTicketLegacyAccess(clientId, projectKey) }), clientId)
  };
  if (settings.provider === "freshdesk") return { name: "freshdesk", provider: withNotifications(freshdeskProvider(projectKey, projectFreshdeskCredentials(settings)), clientId) };
  if (settings.provider !== "zendesk") throw new Error("Unsupported saved ticketing provider");
  return { name: "zendesk", provider: withNotifications(zendeskProvider(projectKey, projectZendeskClient(clientId, projectKey, settings)), clientId) };
}
