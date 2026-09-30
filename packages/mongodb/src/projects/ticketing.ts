import { normalizeFreshdeskDomain, projectFreshdeskCredentials, freshdeskClient } from "./freshdesk.js";
import { ObjectId } from "mongodb";
import { getProjectsCollection } from "../admin/db.js";
import { encrypt, decrypt } from "../encrypt.js";

export type ProjectTicketing = {
  provider: "internal" | "zendesk" | "freshdesk";
  freshdeskDomain?: string;
  freshdeskApiKeyEncrypted?: string;
  subdomain?: string;
  clientId?: string;
  secretEncrypted?: string;
};
export type TicketingInput = {
  provider: string;
  freshdeskDomain?: string | null;
  freshdeskApiKey?: string | null;
  subdomain?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
};
export type ZendeskCredentials = {
  subdomain: string;
  clientId: string;
  clientSecret: string;
};

export function normalizeZendeskSubdomain(value: string) {
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^https:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\.zendesk\.com$/, "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain))
    throw new Error("Enter a valid Zendesk subdomain");
  return domain;
}
function requireKey() {
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error(
      "Configure SUPERADMIN_ENCRYPTION_KEY on admin and ticketing before storing ticketing credentials"
    );
}
export function ticketingSettingsView(settings?: ProjectTicketing) {
  return {
    provider: settings?.provider ?? "internal",
    subdomain: settings?.subdomain ?? "",
    clientId: settings?.clientId ?? "",
    freshdeskDomain: settings?.freshdeskDomain ?? "",
    freshdeskApiKeySet: !!settings?.freshdeskApiKeyEncrypted,
    secretSet: !!settings?.secretEncrypted
  };
}
async function project(clientId: string, id: string) {
  if (!ObjectId.isValid(id)) throw new Error("Project not found for this client");
  const doc = await (
    await getProjectsCollection()
  ).findOne({ _id: new ObjectId(id), clientId });
  if (!doc) throw new Error("Project not found for this client");
  return doc;
}
export async function getProjectTicketing(clientId: string, id: string) {
  return ticketingSettingsView((await project(clientId, id)).ticketing);
}
export function prepareTicketing(
  input: TicketingInput,
  previous?: ProjectTicketing
): ProjectTicketing {
  if (!["internal", "zendesk", "freshdesk"].includes(input.provider))
    throw new Error("Unsupported ticketing provider");
  if (input.provider === "internal") return { ...previous, provider: "internal" };
  requireKey();
  if (input.provider === "freshdesk") {
    const freshdeskDomain = normalizeFreshdeskDomain(input.freshdeskDomain ?? "");
    const apiKey = input.freshdeskApiKey?.trim();
    if (!apiKey && previous?.freshdeskDomain !== freshdeskDomain) throw new Error("Enter the API key when changing the Freshdesk account");
    const freshdeskApiKeyEncrypted = apiKey ? encrypt(apiKey) : previous?.freshdeskApiKeyEncrypted;
    if (!freshdeskApiKeyEncrypted) throw new Error("Freshdesk API key is required");
    return { ...previous, provider: "freshdesk", freshdeskDomain, freshdeskApiKeyEncrypted };
  }
  const subdomain = normalizeZendeskSubdomain(input.subdomain ?? "");
  const clientId = input.clientId?.trim();
  if (!clientId) throw new Error("Zendesk OAuth Identifier is required");
  const secret = input.clientSecret?.trim();
  if (!secret && (previous?.subdomain !== subdomain || previous?.clientId !== clientId))
    throw new Error("Enter the secret when changing the Zendesk account or OAuth client");
  const secretEncrypted = secret ? encrypt(secret) : previous?.secretEncrypted;
  if (!secretEncrypted) throw new Error("Zendesk client secret is required");
  return { ...previous, provider: "zendesk", subdomain, clientId, secretEncrypted };
}
export async function saveProjectTicketing(
  clientId: string,
  id: string,
  input: TicketingInput
) {
  const existing = await project(clientId, id);
  const settings = prepareTicketing(input, existing.ticketing);
  const collection = await getProjectsCollection();
  // Atomic uniqueness protects against two admins assigning one account concurrently.
  // Keep the reservation even while native is selected, preserving account ownership.
  await collection.createIndex(
    { "ticketing.subdomain": 1 },
    {
      unique: true,
      partialFilterExpression: { "ticketing.subdomain": { $type: "string" } },
      name: "unique_ticketing_zendesk_account"
    }
  );
  await collection.createIndex({ "ticketing.freshdeskDomain": 1 }, {
    unique: true, partialFilterExpression: { "ticketing.freshdeskDomain": { $type: "string" } }, name: "unique_ticketing_freshdesk_account"
  });
  try {
    const result = await collection.updateOne(
      { _id: existing._id, clientId },
      { $set: { ticketing: settings, updatedAt: new Date() } }
    );
    if (!result.matchedCount) throw new Error("Project no longer exists");
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      throw new Error("This ticketing account is already assigned to another project");
    throw e;
  }
  return ticketingSettingsView(settings);
}
export function projectZendeskCredentials(
  settings: ProjectTicketing
): ZendeskCredentials {
  requireKey();
  if (!settings.subdomain || !settings.clientId || !settings.secretEncrypted)
    throw new Error("Project Zendesk credentials are incomplete");
  return {
    subdomain: normalizeZendeskSubdomain(settings.subdomain),
    clientId: settings.clientId,
    clientSecret: decrypt(settings.secretEncrypted)
  };
}
export async function resolveProjectTicketing(
  clientId: string,
  projectKey: string
): Promise<ProjectTicketing> {
  const doc = await (await getProjectsCollection()).findOne({ clientId, projectKey });
  if (!doc) throw new Error("Active project does not belong to this client");
  const settings: ProjectTicketing = doc.ticketing ?? { provider: "internal" };
  return settings;
}

export async function issueZendeskServiceToken(credentials: ZendeskCredentials) {
  const domain = normalizeZendeskSubdomain(credentials.subdomain);
  let response: Response;
  try {
    response = await fetch(`https://${domain}.zendesk.com/oauth/tokens`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: "read tickets:write",
        expires_in: 1800
      })
    });
  } catch {
    throw new Error("Could not reach Zendesk authorization service");
  }
  if (!response.ok)
    throw new Error(
      `Zendesk authorization failed (HTTP ${response.status}). Check the confidential OAuth client credentials and allowed scopes: read tickets:write`
    );
  const token = (await response.json()) as { access_token: string; expires_in: number };
  if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0)
    throw new Error("Invalid Zendesk token response");
  return token;
}
export async function testProjectTicketing(
  clientId: string,
  id: string,
  input: TicketingInput
) {
  const settings = prepareTicketing(input, (await project(clientId, id)).ticketing);
  if (settings.provider === "internal")
    return {
      success: true,
      message: "Native ticketing selected; no external connection required"
    };
  if (settings.provider === "freshdesk") {
    try {
      const request = freshdeskClient(projectFreshdeskCredentials(settings));
      await request("agents/me");
      await request("tickets?per_page=1");
      await request("ticket_fields");
      return { success: true, message: "Connected: Freshdesk tickets and fields are accessible. No tickets were changed" };
    } catch (e) { return { success: false, message: e instanceof Error ? e.message : "Freshdesk connection failed" }; }
  }
  const credentials = projectZendeskCredentials(settings);
  try {
    const token = await issueZendeskServiceToken(credentials);
    for (const path of [
      "users/me.json",
      "search.json?query=type%3Aticket&per_page=1",
      "ticket_fields.json"
    ]) {
      const response = await fetch(
        `https://${credentials.subdomain}.zendesk.com/api/v2/${path}`,
        {
          headers: { authorization: `Bearer ${token.access_token}` },
          redirect: "error",
          signal: AbortSignal.timeout(15000)
        }
      );
      if (!response.ok)
        return {
          success: false,
          message: `Zendesk ${path.split("?")[0]} returned HTTP ${response.status}. Check user permissions and read scope`
        };
      const body = (await response.json()) as { user?: { role?: string } };
      if (path === "users/me.json" && !["admin", "agent"].includes(body.user?.role ?? ""))
        return {
          success: false,
          message: "The OAuth client owner must be a Zendesk agent or admin"
        };
    }
    return {
      success: true,
      message:
        "Connected: ticket search and field definitions are accessible. No tickets were changed"
    };
  } catch {
    return {
      success: false,
      message:
        "Zendesk connection failed. Check the subdomain, confidential OAuth client credentials, and read tickets:write scopes"
    };
  }
}

// Legacy native tickets without a client ID can only be attributed when the
// project key belongs to exactly one client in the authoritative admin store.
export async function nativeTicketLegacyAccess(clientId: string, projectKey: string) {
  return !(await (await getProjectsCollection()).findOne({ projectKey, clientId: { $ne: clientId } }));
}
