import { normalizeSalesforceInstanceUrl, resolveProjectCrm } from "@csa/mongodb";
import { projectSalesforceClient, salesforceClient } from "../salesforce/project-client.js";
import { salesforceProvider } from "../salesforce/provider.js";
import type { CrmProvider } from "./types.js";

export function crmProviderName(): "none" | "salesforce" {
  const value = process.env.CRM_PROVIDER?.trim() || "none";
  if (value !== "none" && value !== "salesforce") throw new Error("CRM_PROVIDER must be none or salesforce");
  return value;
}

/** Local development only: requests without client context use env credentials. */
export function crmProvider(): CrmProvider | null {
  if (crmProviderName() !== "salesforce") return null;
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET");
  const instanceUrl = normalizeSalesforceInstanceUrl(process.env.SALESFORCE_INSTANCE_URL ?? "");
  return salesforceProvider(salesforceClient(JSON.stringify(["env", instanceUrl, clientId]), { instanceUrl, clientId, clientSecret }));
}

export async function resolveCrm(
  projectKey: string,
  clientId?: string
): Promise<{ name: "none" | "salesforce"; provider: CrmProvider | null }> {
  if (!clientId) {
    if (process.env.NODE_ENV === "production") throw new Error("An authenticated client is required for CRM");
    return { name: crmProviderName(), provider: crmProvider() };
  }
  const settings = await resolveProjectCrm(clientId, projectKey);
  if (settings.provider === "none") return { name: "none", provider: null };
  if (settings.provider !== "salesforce") throw new Error("Unsupported saved CRM provider");
  return { name: "salesforce", provider: salesforceProvider(projectSalesforceClient(clientId, projectKey, settings)) };
}
