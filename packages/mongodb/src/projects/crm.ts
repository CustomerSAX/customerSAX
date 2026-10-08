import {
  SALESFORCE_API_VERSION,
  issueSalesforceServiceToken,
  normalizeSalesforceInstanceUrl,
  projectSalesforceCredentials
} from "./salesforce.js";
import { hubspotAccountId, hubspotClient } from "./hubspot.js";
import { exchangeZohoGrantCode, isZohoRegion, issueZohoAccessToken, zohoOrg, zohoRequest, type ZohoRegion } from "./zoho.js";
import { ObjectId } from "mongodb";
import { getProjectsCollection } from "../admin/db.js";
import { decrypt, encrypt } from "../encrypt.js";

/** "none" = no CRM connected. There is no native CSA CRM, so nothing is shown rather than substituted. */
export type ProjectCrm = {
  provider: "none" | "salesforce" | "hubspot" | "zoho";
  salesforceInstanceUrl?: string;
  salesforceClientId?: string;
  salesforceSecretEncrypted?: string;
  hubspotTokenEncrypted?: string;
  /** HubSpot Hub ID, looked up from the token on save; used for record links and account reservation. */
  hubspotPortalId?: string;
  zohoRegion?: ZohoRegion;
  zohoClientId?: string;
  zohoSecretEncrypted?: string;
  /** Long-lived token from the one-time grant code exchange (done on save). */
  zohoRefreshTokenEncrypted?: string;
  /** Zoho org ID (account reservation) and domain_name (record links), read on save. */
  zohoOrgId?: string;
  zohoOrgDomain?: string;
};
export type CrmInput = {
  provider: string;
  salesforceInstanceUrl?: string | null;
  salesforceClientId?: string | null;
  salesforceClientSecret?: string | null;
  hubspotAccessToken?: string | null;
  zohoRegion?: string | null;
  zohoClientId?: string | null;
  zohoClientSecret?: string | null;
  /** One-time Self Client grant code; exchanged on save, never stored. */
  zohoGrantCode?: string | null;
};

const PROVIDERS = ["none", "salesforce", "hubspot", "zoho"];

function requireKey() {
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error("Configure SUPERADMIN_ENCRYPTION_KEY on admin and crm before storing CRM credentials");
}
export function crmSettingsView(settings?: ProjectCrm) {
  return {
    provider: settings?.provider ?? "none",
    salesforceInstanceUrl: settings?.salesforceInstanceUrl ?? "",
    salesforceClientId: settings?.salesforceClientId ?? "",
    salesforceSecretSet: !!settings?.salesforceSecretEncrypted,
    hubspotPortalId: settings?.hubspotPortalId ?? "",
    hubspotTokenSet: !!settings?.hubspotTokenEncrypted,
    zohoRegion: settings?.zohoRegion ?? "",
    zohoClientId: settings?.zohoClientId ?? "",
    zohoSecretSet: !!settings?.zohoSecretEncrypted,
    zohoConnected: !!settings?.zohoRefreshTokenEncrypted,
    zohoOrgId: settings?.zohoOrgId ?? ""
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
/**
 * A project keeps only the credentials of the CRM it currently uses. Switching to
 * "none" or to another CRM drops the previous CRM's saved key, which also frees
 * that CRM account for another project (unlike ticketing, which keeps it reserved).
 */
export function prepareCrm(input: CrmInput, current?: ProjectCrm): ProjectCrm {
  if (!PROVIDERS.includes(input.provider)) throw new Error("Unsupported CRM provider");
  if (input.provider === "none") return { provider: "none" };
  requireKey();
  const previous = current?.provider === input.provider ? current : undefined;
  if (input.provider === "hubspot") {
    const token = input.hubspotAccessToken?.trim();
    if (token && !/^pat-[a-z]{2}\d-/.test(token))
      throw new Error("Enter a HubSpot service key or private app access token (it starts with pat-)");
    const hubspotTokenEncrypted = token ? encrypt(token) : previous?.hubspotTokenEncrypted;
    if (!hubspotTokenEncrypted) throw new Error("HubSpot access token is required");
    // A new token may belong to another HubSpot account; its Hub ID is looked up again on save.
    const hubspotPortalId = token ? undefined : previous?.hubspotPortalId;
    return { provider: "hubspot", hubspotTokenEncrypted, ...(hubspotPortalId ? { hubspotPortalId } : {}) };
  }
  if (input.provider === "zoho") {
    const zohoRegion = input.zohoRegion?.trim() ?? "";
    if (!isZohoRegion(zohoRegion)) throw new Error("Choose the Zoho region your CRM account is in");
    const zohoClientId = input.zohoClientId?.trim();
    if (!zohoClientId) throw new Error("Zoho client ID is required");
    const sameClient = previous?.zohoRegion === zohoRegion && previous?.zohoClientId === zohoClientId;
    const secret = input.zohoClientSecret?.trim();
    if (!secret && !sameClient) throw new Error("Enter the client secret when changing the Zoho region or client ID");
    const zohoSecretEncrypted = secret ? encrypt(secret) : previous?.zohoSecretEncrypted;
    if (!zohoSecretEncrypted) throw new Error("Zoho client secret is required");
    // A new grant code, secret or client replaces the connection; the code is exchanged on save.
    const grantCode = input.zohoGrantCode?.trim();
    const keepConnection = sameClient && !grantCode && !secret && !!previous?.zohoRefreshTokenEncrypted;
    if (!keepConnection && !grantCode)
      throw new Error("Generate a grant code in the Zoho Self Client and paste it to connect");
    return {
      provider: "zoho",
      zohoRegion,
      zohoClientId,
      zohoSecretEncrypted,
      ...(keepConnection
        ? {
            zohoRefreshTokenEncrypted: previous!.zohoRefreshTokenEncrypted,
            ...(previous!.zohoOrgId ? { zohoOrgId: previous!.zohoOrgId } : {}),
            ...(previous!.zohoOrgDomain ? { zohoOrgDomain: previous!.zohoOrgDomain } : {})
          }
        : {})
    };
  }
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
  return { provider: "salesforce", salesforceInstanceUrl, salesforceClientId, salesforceSecretEncrypted };
}
export async function saveProjectCrm(clientId: string, id: string, input: CrmInput) {
  const existing = await project(clientId, id);
  const settings = prepareCrm(input, existing.crm);
  if (settings.provider === "hubspot" && !settings.hubspotPortalId) {
    // Unknown when HubSpot won't report it for this key: then no record links and no account reservation.
    const accountId = await hubspotAccountId(decrypt(settings.hubspotTokenEncrypted!));
    if (accountId) settings.hubspotPortalId = accountId;
  }
  if (settings.provider === "zoho" && !settings.zohoRefreshTokenEncrypted) {
    // Grant codes work once: exchange it, prove access, then keep only the refresh token.
    const exchanged = await exchangeZohoGrantCode(
      settings.zohoRegion!,
      settings.zohoClientId!,
      decrypt(settings.zohoSecretEncrypted!),
      input.zohoGrantCode!.trim()
    );
    const session = { accessToken: exchanged.accessToken, apiDomain: exchanged.apiDomain };
    const failure = await probeZoho(session);
    if (failure) throw new Error(failure);
    settings.zohoRefreshTokenEncrypted = encrypt(exchanged.refreshToken);
    const org = await zohoOrg(session).catch(() => ({ orgId: null, orgDomain: null }));
    if (org.orgId) settings.zohoOrgId = org.orgId;
    if (org.orgDomain) settings.zohoOrgDomain = org.orgDomain;
  }
  const collection = await getProjectsCollection();
  // Atomic uniqueness protects against two admins assigning one account concurrently.
  // A project only holds the account it actively uses (see prepareCrm), so the reservation is released on disconnect.
  await collection.createIndex(
    { "crm.salesforceInstanceUrl": 1 },
    {
      unique: true,
      partialFilterExpression: { "crm.salesforceInstanceUrl": { $type: "string" } },
      name: "unique_crm_salesforce_org"
    }
  );
  await collection.createIndex(
    { "crm.hubspotPortalId": 1 },
    {
      unique: true,
      partialFilterExpression: { "crm.hubspotPortalId": { $type: "string" } },
      name: "unique_crm_hubspot_account"
    }
  );
  await collection.createIndex(
    { "crm.zohoOrgId": 1 },
    {
      unique: true,
      partialFilterExpression: { "crm.zohoOrgId": { $type: "string" } },
      name: "unique_crm_zoho_org"
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
      throw new Error("This CRM account is already assigned to another project");
    throw e;
  }
  return crmSettingsView(settings);
}
/** Zoho read probes; returns a message naming the missing scope, or null when all pass. */
const ZOHO_PROBES: Array<[path: string, scope: string]> = [
  ["Contacts?fields=Last_Name&per_page=1", "ZohoCRM.modules.contacts.ALL"],
  ["Accounts?fields=Account_Name&per_page=1", "ZohoCRM.modules.accounts.READ"],
  ["Calls?fields=Subject&per_page=1", "ZohoCRM.modules.calls.ALL"],
  ["Tasks?fields=Subject&per_page=1", "ZohoCRM.modules.tasks.ALL"],
  ["Contacts/search?word=csa&fields=Last_Name&per_page=1", "ZohoSearch.securesearch.READ"]
];
async function probeZoho(session: { accessToken: string; apiDomain: string }) {
  for (const [path, scope] of ZOHO_PROBES) {
    try {
      await zohoRequest(session, path);
    } catch (e) {
      const { status, code } = e as { status?: number; code?: string };
      if (status === 403 || code === "OAUTH_SCOPE_MISMATCH")
        return `The Zoho grant code is missing the "${scope}" scope. Generate a new code with all required scopes`;
      return e instanceof Error ? e.message : "Zoho connection failed";
    }
  }
  return null;
}
async function testZoho(settings: ProjectCrm) {
  if (!settings.zohoRefreshTokenEncrypted)
    return {
      success: false,
      message:
        "A Zoho grant code works only once. Click Save CRM Settings: saving exchanges the code and checks the connection. Use Test Connection afterwards"
    };
  try {
    const token = await issueZohoAccessToken({
      region: settings.zohoRegion!,
      clientId: settings.zohoClientId!,
      clientSecret: decrypt(settings.zohoSecretEncrypted!),
      refreshToken: decrypt(settings.zohoRefreshTokenEncrypted)
    });
    const failure = await probeZoho(token);
    if (failure) return { success: false, message: failure };
    return {
      success: true,
      message: `Connected to Zoho CRM${settings.zohoOrgId ? ` org ${settings.zohoOrgId}` : ""}: contacts, accounts, calls and tasks are readable. No records were changed`
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Zoho connection failed" };
  }
}
/** Read-only probes; each maps to the scope it proves, so a failure names exactly what to add. */
const HUBSPOT_PROBES: Array<[path: string, scope: string]> = [
  ["crm/v3/objects/contacts?limit=1", "crm.objects.contacts.read"],
  ["crm/v3/objects/companies?limit=1", "crm.objects.companies.read"],
  ["crm/v3/objects/tasks?limit=1", "crm.objects.contacts.read"],
  ["crm/v3/owners?limit=1", "crm.objects.owners.read"],
  ["crm/v3/objects/emails?limit=1", "sales-email-read"]
];
async function testHubspot(settings: ProjectCrm) {
  const accessToken = decrypt(settings.hubspotTokenEncrypted!);
  const request = hubspotClient({ accessToken, portalId: null });
  for (const [path, scope] of HUBSPOT_PROBES) {
    try {
      await request(path);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) return { success: false, message: `The HubSpot key is missing the "${scope}" scope` };
      return { success: false, message: e instanceof Error ? e.message : "HubSpot connection failed" };
    }
  }
  const accountId = await hubspotAccountId(accessToken);
  return {
    success: true,
    message: accountId
      ? `Connected to HubSpot account ${accountId}: contacts, companies, owners and activities are readable. No records were changed`
      : `Connected to HubSpot: contacts, companies, owners and activities are readable. No records were changed. HubSpot didn't report the account ID for this key, so "Open in HubSpot" links will be unavailable (add the "oauth" scope if offered)`
  };
}
export async function testProjectCrm(clientId: string, id: string, input: CrmInput) {
  const settings = prepareCrm(input, (await project(clientId, id)).crm);
  if (settings.provider === "none")
    return { success: true, message: "No CRM selected; no external connection required" };
  if (settings.provider === "hubspot") return testHubspot(settings);
  if (settings.provider === "zoho") return testZoho(settings);
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
