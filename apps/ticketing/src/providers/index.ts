import { resolveProjectTicketing, nativeTicketLegacyAccess } from "@csa/mongodb";
import { projectZendeskClient } from "../zendesk/project-client.js";
import * as native from "../tickets/repository.js";
import { zendeskProvider } from "../zendesk/provider.js";
import type { TicketingProvider } from "./types.js";

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
    getTicket: (id) => native.getTicket(id, projectKey, scope),
    listTickets: (args) => native.listTickets({ ...args, projectKey }, scope),
    createTicket: (draft) => native.createTicket({ ...draft, projectKey }, scope),
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
    name: "internal", provider: nativeProvider(projectKey, { clientId, includeLegacy: await nativeTicketLegacyAccess(clientId, projectKey) })
  };
  if (settings.provider !== "zendesk") throw new Error("Unsupported saved ticketing provider");
  return { name: "zendesk", provider: zendeskProvider(projectKey, projectZendeskClient(clientId, projectKey, settings)) };
}
