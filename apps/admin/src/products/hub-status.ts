import { projectHubIdentity, crmSettingsView } from "@csa/mongodb";
import { hubRuntime, type HubProject } from "@csa/connection-hub";

export function integrationStatus(scope: HubProject | undefined) {
  const enabled = scope?.bindings.filter((item) => item.enabled) ?? [];
  const zendesk = enabled.find(
    (item) =>
      item.connectorId === "zendesk" &&
      ["zendesk-read", "zendesk-custom-api-call"].includes(item.canonicalAction)
  );
  const crm = enabled.find((item) =>
    ["salesforce", "hubspot", "zoho-crm"].includes(item.connectorId)
  );
  const algolia = enabled.filter((item) => item.connectorId === "algolia");
  return {
    ticketing: {
      provider: zendesk ? "zendesk" : "internal",
      subdomain: zendesk?.providerAccount ?? "",
      clientId: "",
      secretSet: false,
      freshdeskDomain: "",
      freshdeskApiKeySet: false
    },
    crm: {
      ...crmSettingsView(),
      provider: crm?.connectorId === "zoho-crm" ? "zoho" : (crm?.connectorId ?? "none")
    },
    products: {
      configured: true,
      provider: algolia.length ? "algolia" : "commercetools",
      appId: "",
      indexName: algolia[0]?.allowedIndex ?? "",
      searchApiKeySet: false
    }
  };
}
export async function projectHubSettings(clientId: string, id: string) {
  const identity = await projectHubIdentity(clientId, id);
  return integrationStatus(
    await hubRuntime.project(identity.clientId, identity.projectKey)
  );
}
