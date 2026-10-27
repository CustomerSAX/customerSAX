import { assertProjectScope } from "@csa/mongodb";
import { hubRuntime, HubRuntimeError } from "@csa/connection-hub";
import { createHubspotProvider } from "../hubspot/provider.js";
import { salesforceProvider } from "../salesforce/provider.js";
import { zohoProvider } from "../zoho/provider.js";
import type { CrmProvider } from "./types.js";

export type CrmProviderName = "none" | "salesforce" | "hubspot" | "zoho";
export function crmProviderName(): CrmProviderName {
  return "none";
}
export function crmProvider(): CrmProvider | null {
  return null;
}

export async function resolveCrm(
  projectKey: string,
  clientId?: string
): Promise<{ name: CrmProviderName; provider: CrmProvider | null }> {
  if (!clientId) {
    if (process.env.NODE_ENV === "production")
      throw new Error("An authenticated client is required for CRM");
    return { name: "none", provider: null };
  }
  await assertProjectScope({ clientId, projectKey });
  const scope = await hubRuntime.project(clientId, projectKey);
  if (!scope) return { name: "none", provider: null };
  const enabled = scope.bindings.filter(
    (item) =>
      item.enabled && ["salesforce", "hubspot", "zoho-crm"].includes(item.connectorId)
  );
  const providers = new Set(enabled.map((item) => item.connectorId));
  if (!providers.size) return { name: "none", provider: null };
  if (providers.size > 1)
    throw new HubRuntimeError(
      "Multiple CRM connectors are enabled. Select one CRM in Connection Hub.",
      409
    );
  const connectorId = enabled[0].connectorId;
  const binding = enabled.find(
    (item) => item.canonicalAction === `${connectorId}-custom-api-call`
  );
  if (!binding)
    throw new HubRuntimeError(
      "Enable Custom API Call on the selected Connection Hub CRM to use the CRM workspace.",
      409
    );
  if (enabled.some((item) => item.connectionId !== binding.connectionId))
    throw new HubRuntimeError(
      "CRM actions use different accounts. Reconnect the CRM in Connection Hub.",
      409
    );
  const api = <T>(path: string, method = "GET", body?: unknown) =>
    hubRuntime.api<T>(scope, binding, path, method, body);
  if (connectorId === "hubspot")
    return {
      name: "hubspot",
      provider: createHubspotProvider(<T>(path: string, method = "GET", body?: unknown) =>
        api<T>(`/${path}`, method, body)
      )
    };
  if (connectorId === "zoho-crm")
    return {
      name: "zoho",
      provider: zohoProvider({
        api: <T>(path: string, method = "GET", body?: unknown) =>
          api<T>(`/crm/v8/${path}`, method, body),
        recordBase: null
      })
    };
  const origin = new URL(binding.allowedIndex).origin;
  if (!origin.startsWith("https://") || !origin.endsWith(".salesforce.com"))
    throw new HubRuntimeError("Invalid Salesforce account in Connection Hub", 502);
  return {
    name: "salesforce",
    provider: salesforceProvider({
      instanceUrl: async () => origin,
      api: <T>(path: string, method = "GET", body?: unknown) =>
        api<T>(`/services/data/v56.0/${path}`, method, body)
    })
  };
}
