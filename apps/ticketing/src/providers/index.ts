import { connectionHubZendesk } from "../zendesk/connection-hub.js";
import { withNotifications } from "../notifications/provider.js";
import { assertProjectScope, getProjectSlaTargets, nativeTicketLegacyAccess } from "@csa/mongodb";
import * as native from "../tickets/repository.js";
import { zendeskProvider } from "../zendesk/provider.js";
import type { TicketingProvider } from "./types.js";
import type { SlaTarget } from "../tickets/native-sla.js";
import {
  aiFollowupEnabled,
  requestTicketInformation
} from "../email/information-request.js";
import { localEmailConfig } from "../email/config.js";
import { sendTicketCreated } from "../email/ticket-created.js";

// External providers are selected exclusively by enabled Hub project bindings.
export function ticketingProviderName(): "internal" {
  return "internal";
}
export function ticketingProvider(projectKey: string): TicketingProvider {
  return nativeProvider(projectKey);
}

/**
 * @param slaTargets Loads the project's native SLA targets; read only when a
 * ticket is created, since each new ticket copies the targets in force then.
 */
function nativeProvider(
  projectKey: string,
  scope?: native.NativeTicketScope,
  slaTargets?: () => Promise<Partial<Record<string, SlaTarget>> | undefined>
): TicketingProvider {
  return {
    requestInformation: (id, expected, questions) => {
      if (!scope)
        throw new Error("An authenticated client is required for customer email");
      return requestTicketInformation(id, expected, questions, projectKey, scope);
    },
    closeIfUnchanged: (id, expectedLastModifiedAt, solution) =>
      native.closeIfUnchanged(id, expectedLastModifiedAt, projectKey, scope, solution),
    getTicket: (id) => native.getTicket(id, projectKey, scope),
    listTickets: (args) => native.listTickets({ ...args, projectKey }, scope),
    createTicket: async (draft) => {
      const emailConfig = localEmailConfig(projectKey);
      const ticket = await native.createTicket({ ...draft, projectKey }, scope, await slaTargets?.());
      if (!aiFollowupEnabled()) await sendTicketCreated(ticket, emailConfig);
      return ticket;
    },
    updateTicket: (id, patch) => native.updateTicket(id, { ...patch, projectKey }, scope),
    addWorklog: (id, comment) => native.addWorklog(id, comment, projectKey, scope)
  };
}

export async function resolveTicketing(projectKey: string, clientId?: string) {
  if (!clientId) {
    if (process.env.NODE_ENV === "production")
      throw new Error("An authenticated client is required for ticketing");
    return { name: ticketingProviderName(), provider: ticketingProvider(projectKey) };
  }
  await assertProjectScope({ clientId, projectKey });
  const hub = await connectionHubZendesk.forProject({ clientId, projectKey });
  if (hub)
    return {
      name: "zendesk",
      provider: withNotifications(zendeskProvider(projectKey, hub), clientId)
    };
  return {
    name: "internal",
    provider: withNotifications(
      nativeProvider(
        projectKey,
        {
          clientId,
          includeLegacy: await nativeTicketLegacyAccess(clientId, projectKey)
        },
        () => getProjectSlaTargets(clientId, projectKey)
      ),
      clientId
    )
  };
}
