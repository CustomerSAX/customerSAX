import { isZohoRegion, normalizeSalesforceInstanceUrl, projectHubspotCredentials, resolveProjectCrm } from "@csa/mongodb";
import { hubspotProvider } from "../hubspot/provider.js";
import { projectSalesforceClient, salesforceClient } from "../salesforce/project-client.js";
import { salesforceProvider } from "../salesforce/provider.js";
import { projectZohoClient, zohoClient } from "../zoho/project-client.js";
import { zohoProvider } from "../zoho/provider.js";
import type { CrmProvider } from "./types.js";

export type CrmProviderName = "none" | "salesforce" | "hubspot" | "zoho";

export function crmProviderName(): CrmProviderName {
  const value = process.env.CRM_PROVIDER?.trim() || "none";
  if (value !== "none" && value !== "salesforce" && value !== "hubspot" && value !== "zoho")
    throw new Error("CRM_PROVIDER must be none, salesforce, hubspot or zoho");
  return value;
}

/** Local development only: requests without client context use env credentials. */
export function crmProvider(): CrmProvider | null {
  const name = crmProviderName();
  if (name === "hubspot") {
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
    if (!accessToken) throw new Error("Set HUBSPOT_ACCESS_TOKEN");
    return hubspotProvider({ accessToken, portalId: process.env.HUBSPOT_PORTAL_ID?.trim() || null });
  }
  if (name === "zoho") {
    const region = process.env.ZOHO_REGION?.trim() ?? "";
    const clientId = process.env.ZOHO_CLIENT_ID?.trim();
    const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();
    if (!isZohoRegion(region) || !clientId || !clientSecret || !refreshToken)
      throw new Error("Set ZOHO_REGION, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN");
    return zohoProvider(
      zohoClient(JSON.stringify(["env", region, clientId]), { region, clientId, clientSecret, refreshToken, orgDomain: process.env.ZOHO_ORG_DOMAIN?.trim() || null })
    );
  }
  if (name !== "salesforce") return null;
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET");
  const instanceUrl = normalizeSalesforceInstanceUrl(process.env.SALESFORCE_INSTANCE_URL ?? "");
  return salesforceProvider(salesforceClient(JSON.stringify(["env", instanceUrl, clientId]), { instanceUrl, clientId, clientSecret }));
}

export async function resolveCrm(
  projectKey: string,
  clientId?: string
): Promise<{ name: CrmProviderName; provider: CrmProvider | null }> {
  if (!clientId) {
    if (process.env.NODE_ENV === "production") throw new Error("An authenticated client is required for CRM");
    return { name: crmProviderName(), provider: crmProvider() };
  }
  const settings = await resolveProjectCrm(clientId, projectKey);
  if (settings.provider === "none") return { name: "none", provider: null };
  if (settings.provider === "hubspot")
    return { name: "hubspot", provider: hubspotProvider(projectHubspotCredentials(settings)) };
  if (settings.provider === "zoho")
    return { name: "zoho", provider: zohoProvider(projectZohoClient(clientId, projectKey, settings)) };
  if (settings.provider !== "salesforce") throw new Error("Unsupported saved CRM provider");
  return { name: "salesforce", provider: salesforceProvider(projectSalesforceClient(clientId, projectKey, settings)) };
}
