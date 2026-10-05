import {
  SALESFORCE_API_VERSION,
  issueSalesforceServiceToken,
  normalizeSalesforceInstanceUrl,
  projectSalesforceCredentials
} from "./salesforce.js";
import { ObjectId } from "mongodb";
import { getProjectsCollection } from "../admin/db.js";
import { encrypt } from "../encrypt.js";

/** "none" = no CRM connected. There is no native CSA CRM, so nothing is shown rather than substituted. */
export type ProjectCrm = {
  provider: "none" | "salesforce";
  salesforceInstanceUrl?: string;
  salesforceClientId?: string;
  salesforceSecretEncrypted?: string;
};
export type CrmInput = {
  provider: string;
  salesforceInstanceUrl?: string | null;
  salesforceClientId?: string | null;
  salesforceClientSecret?: string | null;
};

function requireKey() {
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error("Configure SUPERADMIN_ENCRYPTION_KEY on admin and crm before storing CRM credentials");
}
export function crmSettingsView(settings?: ProjectCrm) {
  return {
    provider: settings?.provider ?? "none",
    salesforceInstanceUrl: settings?.salesforceInstanceUrl ?? "",
    salesforceClientId: settings?.salesforceClientId ?? "",
    salesforceSecretSet: !!settings?.salesforceSecretEncrypted
  };
}
async function project(clientId: string, id: string) {
  if (!ObjectId.isValid(id)) throw new Error("Project not found for this client");
  const doc = await (await getProjectsCollection()).findOne({ _id: new ObjectId(id), clientId });
  if (!doc) throw new Error("Project not found for this client");
  return doc;
}
export async function getProjectCrm(clientId: string, id: string) {
  return crmSettingsView((await project(clientId, id)).crm);
}
export function prepareCrm(input: CrmInput, previous?: ProjectCrm): ProjectCrm {
  if (!["none", "salesforce"].includes(input.provider)) throw new Error("Unsupported CRM provider");
  if (input.provider === "none") return { ...previous, provider: "none" };
  requireKey();
  const salesforceInstanceUrl = normalizeSalesforceInstanceUrl(input.salesforceInstanceUrl ?? "");
  const salesforceClientId = input.salesforceClientId?.trim();
  if (!salesforceClientId) throw new Error("Salesforce consumer key is required");
  const secret = input.salesforceClientSecret?.trim();
  if (
    !secret &&
    (previous?.salesforceInstanceUrl !== salesforceInstanceUrl || previous?.salesforceClientId !== salesforceClientId)
  )
    throw new Error("Enter the consumer secret when changing the Salesforce org or consumer key");
  const salesforceSecretEncrypted = secret ? encrypt(secret) : previous?.salesforceSecretEncrypted;
  if (!salesforceSecretEncrypted) throw new Error("Salesforce consumer secret is required");
  return { ...previous, provider: "salesforce", salesforceInstanceUrl, salesforceClientId, salesforceSecretEncrypted };
}
export async function saveProjectCrm(clientId: string, id: string, input: CrmInput) {
  const existing = await project(clientId, id);
  const settings = prepareCrm(input, existing.crm);
  const collection = await getProjectsCollection();
  // Atomic uniqueness protects against two admins assigning one org concurrently.
  // Keep the reservation while "none" is selected, preserving org ownership.
  await collection.createIndex(
    { "crm.salesforceInstanceUrl": 1 },
    {
      unique: true,
      partialFilterExpression: { "crm.salesforceInstanceUrl": { $type: "string" } },
      name: "unique_crm_salesforce_org"
    }
  );
  try {
    const result = await collection.updateOne(
      { _id: existing._id, clientId },
      { $set: { crm: settings, updatedAt: new Date() } }
    );
    if (!result.matchedCount) throw new Error("Project no longer exists");
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      throw new Error("This Salesforce org is already assigned to another project");
    throw e;
  }
  return crmSettingsView(settings);
}
export async function testProjectCrm(clientId: string, id: string, input: CrmInput) {
  const settings = prepareCrm(input, (await project(clientId, id)).crm);
  if (settings.provider === "none")
    return { success: true, message: "No CRM selected; no external connection required" };
  try {
    const token = await issueSalesforceServiceToken(projectSalesforceCredentials(settings));
    for (const soql of ["SELECT Id FROM Contact LIMIT 1", "SELECT Id FROM Account LIMIT 1", "SELECT Id FROM Task LIMIT 1"]) {
      const response = await fetch(
        `${token.instanceUrl}/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(soql)}`,
        { headers: { authorization: `Bearer ${token.accessToken}` }, redirect: "error", signal: AbortSignal.timeout(15000) }
      );
      if (!response.ok)
        return {
          success: false,
          message: `Salesforce ${soql.split(" ")[3]} read returned HTTP ${response.status}. Check the Run As user's object permissions`
        };
    }
    return { success: true, message: "Connected: contacts, accounts and activities are readable. No records were changed" };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Salesforce connection failed" };
  }
}
export async function resolveProjectCrm(clientId: string, projectKey: string): Promise<ProjectCrm> {
  const doc = await (await getProjectsCollection()).findOne({ clientId, projectKey });
  if (!doc) throw new Error("Active project does not belong to this client");
  return doc.crm ?? { provider: "none" };
}
