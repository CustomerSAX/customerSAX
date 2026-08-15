/**
 * MongoDB CRUD for CSA commerce project configurations. Secrets are
 * encrypted at rest with AES-256-GCM (see ../encrypt.ts) and are never
 * returned outside this service except in the one internal function that
 * decrypts for a live connection test.
 */

import { ObjectId } from "mongodb";
import { getProjectsCollection } from "../admin/db.js";
import { createCollectionAccessor } from "../collection-accessor.js";
import { encrypt, decrypt } from "../encrypt.js";
import type { CommercePlatform, CsaProject, ProjectCredentials } from "./types.js";

/** Shared id-keyed helpers over the `csa_projects` collection. */
const projects = createCollectionAccessor(getProjectsCollection);

/**
 * CommerceTools REST calls use `{origin}/{projectKey}/…` — the API root
 * must not already include a project segment or `/graphql`.
 */
function sanitizeCtApiOriginForProjectPaths(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    if (/\.commercetools\.com$/i.test(u.hostname)) {
      return u.origin;
    }
  } catch {
    /* fall through */
  }
  return trimmed.replace(/\/graphql\/?$/i, "").replace(/\/$/, "");
}

function projectPlatform(doc: CsaProject): CommercePlatform {
  return doc.platform ?? "commercetools";
}

function ctCredsView(doc: CsaProject) {
  const c = doc.credentials?.commercetools;
  return {
    ctApiUrl: c?.apiUrl ?? doc.ctApiUrl ?? "",
    ctAuthUrl: c?.authUrl ?? doc.ctAuthUrl ?? "",
    ctClientId: c?.clientId ?? doc.ctClientId ?? "",
    ctClientSecretEncrypted: c?.clientSecretEncrypted ?? doc.ctClientSecretEncrypted ?? "",
    scopes: c?.scopes ?? doc.scopes,
  };
}

function maskSecret(secret: string): string {
  if (!secret) return "••••••••";
  if (secret.length <= 6) return "••••••••";
  return `${secret.slice(0, 3)}••••••••${secret.slice(-3)}`;
}

export function projectSecretMasked(doc: CsaProject): string {
  const ct = ctCredsView(doc);
  try {
    return maskSecret(decrypt(ct.ctClientSecretEncrypted));
  } catch {
    return "••••••••";
  }
}

export function projectView(doc: CsaProject) {
  const { _id, credentials, platform, ctApiUrl: _a, ctAuthUrl: _b, ctClientId: _c, ctClientSecretEncrypted: _d, scopes: _e, ...rest } = doc;
  void credentials;
  const ct = ctCredsView(doc);
  return {
    id: _id.toHexString(),
    ...rest,
    platform: projectPlatform(doc),
    ctApiUrl: ct.ctApiUrl,
    ctAuthUrl: ct.ctAuthUrl,
    ctClientId: ct.ctClientId,
    scopes: ct.scopes,
    ctClientSecretMasked: projectSecretMasked(doc),
    shopifyStoreDomain: doc.credentials?.shopify?.storeDomain,
    shopifyApiVersion: doc.credentials?.shopify?.apiVersion,
    bigcommerceStoreHash: doc.credentials?.bigcommerce?.storeHash,
    bigcommerceClientId: doc.credentials?.bigcommerce?.clientId,
  };
}

export async function listProjectsByClient(clientId: string): Promise<CsaProject[]> {
  const col = await getProjectsCollection();
  const docs = await col.find({ clientId }).sort({ projectKey: 1 }).toArray();
  return docs as unknown as CsaProject[];
}

/**
 * Tenant-scoped project lookup: matches ONLY when the project belongs to
 * `clientId` (`{ _id, clientId }`). This is the safe default — a caller that is
 * bound to one organisation can never read another tenant's project by id.
 * Superadmin/cross-client flows must use `findProjectByIdAnyClient` explicitly.
 */
export async function findProjectById(id: string, clientId: string): Promise<CsaProject | null> {
  return (await projects.findById(id, { clientId })) as CsaProject | null;
}

/**
 * UNSCOPED project lookup by id — reads across all tenants. ONLY for
 * superadmin/server-internal flows where cross-client scope is already enforced
 * upstream (e.g. the admin subgraph's `authorize()` superadmin gate, or the
 * internal connection-test path). Never call this from a client-scoped path.
 */
export async function findProjectByIdAnyClient(id: string): Promise<CsaProject | null> {
  return (await projects.findById(id)) as CsaProject | null;
}

export async function countProjectsByClient(clientId: string): Promise<number> {
  const col = await getProjectsCollection();
  return col.countDocuments({ clientId });
}

/**
 * Returns the project with its decrypted secret. ONLY for internal
 * server-to-server operations (connection tests) — never expose outside
 * this service's connection-test resolver.
 */
export async function getProjectWithSecret(id: string): Promise<
  | (ReturnType<typeof projectView> & {
      ctClientSecret?: string;
      shopifyAdminAccessToken?: string;
      bigcommerceAccessToken?: string;
    })
  | null
> {
  // Internal server-to-server connection test — reached only from the admin
  // subgraph's superadmin-gated `adminTestProjectConnection`, so a cross-client
  // (unscoped) lookup is correct and intentional here.
  const doc = await findProjectByIdAnyClient(id);
  if (!doc) return null;

  const view = projectView(doc);
  const ctClientSecret =
    doc.platform !== "shopify" && doc.platform !== "bigcommerce" && ctCredsView(doc).ctClientSecretEncrypted
      ? decrypt(ctCredsView(doc).ctClientSecretEncrypted)
      : undefined;
  const shopifyAdminAccessToken =
    doc.platform === "shopify" && doc.credentials?.shopify?.adminAccessTokenEncrypted
      ? decrypt(doc.credentials.shopify.adminAccessTokenEncrypted)
      : undefined;
  const bigcommerceAccessToken =
    doc.platform === "bigcommerce" && doc.credentials?.bigcommerce?.accessTokenEncrypted
      ? decrypt(doc.credentials.bigcommerce.accessTokenEncrypted)
      : undefined;

  return { ...view, ctClientSecret, shopifyAdminAccessToken, bigcommerceAccessToken };
}

export async function createProject(data: {
  clientId: string;
  platform?: CommercePlatform;
  projectKey: string;
  displayName: string;
  ctApiUrl?: string;
  ctAuthUrl?: string;
  ctClientId?: string;
  ctClientSecret?: string;
  scopes?: string;
  shopifyStoreDomain?: string;
  shopifyAdminAccessToken?: string;
  shopifyApiVersion?: string;
  bigcommerceStoreHash?: string;
  bigcommerceClientId?: string;
  bigcommerceAccessToken?: string;
  createdBy: string;
  standaloneB2cEnabled?: boolean;
  standaloneB2bEnabled?: boolean;
}): Promise<CsaProject> {
  const col = await getProjectsCollection();
  const now = new Date();
  const platform: CommercePlatform = data.platform ?? "commercetools";

  let credentials: ProjectCredentials;
  let ctApiUrl = "";
  let ctAuthUrl = "";
  let ctClientId = "";
  let ctClientSecretEncrypted = "";
  let scopes: string | undefined;

  if (platform === "shopify") {
    const storeDomain = (data.shopifyStoreDomain ?? "").trim();
    const apiVersion = (data.shopifyApiVersion ?? "").trim();
    const token = data.shopifyAdminAccessToken ?? "";
    if (!storeDomain || !apiVersion || !token.trim()) {
      throw new Error("Shopify projects require a store domain, API version, and admin access token.");
    }
    credentials = { shopify: { storeDomain, adminAccessTokenEncrypted: encrypt(token), apiVersion } };
  } else if (platform === "bigcommerce") {
    const storeHash = (data.bigcommerceStoreHash ?? "").trim();
    const clientId = (data.bigcommerceClientId ?? "").trim();
    const token = data.bigcommerceAccessToken ?? "";
    if (!storeHash || !clientId || !token.trim()) {
      throw new Error("BigCommerce projects require a store hash, client ID, and access token.");
    }
    credentials = { bigcommerce: { storeHash, clientId, accessTokenEncrypted: encrypt(token) } };
  } else {
    ctApiUrl = sanitizeCtApiOriginForProjectPaths((data.ctApiUrl ?? "").trim());
    ctAuthUrl = (data.ctAuthUrl ?? "").trim().replace(/\/$/, "");
    ctClientId = (data.ctClientId ?? "").trim();
    if (!ctApiUrl || !ctAuthUrl || !ctClientId || !data.ctClientSecret) {
      throw new Error("CommerceTools projects require an API URL, Auth URL, client id, and client secret.");
    }
    ctClientSecretEncrypted = encrypt(data.ctClientSecret);
    scopes = data.scopes?.trim() || undefined;
    credentials = {
      commercetools: { apiUrl: ctApiUrl, authUrl: ctAuthUrl, clientId: ctClientId, clientSecretEncrypted: ctClientSecretEncrypted, scopes },
    };
  }

  const doc: CsaProject = {
    _id: new ObjectId(),
    clientId: data.clientId,
    platform,
    credentials,
    projectKey: data.projectKey.trim(),
    displayName: data.displayName.trim(),
    ctApiUrl,
    ctAuthUrl,
    ctClientId,
    ctClientSecretEncrypted,
    scopes,
    smtpProfileId: undefined,
    standaloneB2cEnabled: data.standaloneB2cEnabled !== false,
    standaloneB2bEnabled: data.standaloneB2bEnabled === true,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc as never);
  return doc;
}

export async function updateProject(
  id: string,
  updates: {
    displayName?: string;
    ctApiUrl?: string;
    ctAuthUrl?: string;
    ctClientId?: string;
    ctClientSecret?: string;
    scopes?: string;
    smtpProfileId?: string | null;
    standaloneB2cEnabled?: boolean;
    standaloneB2bEnabled?: boolean;
    shopifyStoreDomain?: string;
    shopifyAdminAccessToken?: string;
    shopifyApiVersion?: string;
    bigcommerceStoreHash?: string;
    bigcommerceClientId?: string;
    bigcommerceAccessToken?: string;
  }
): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.displayName !== undefined) set.displayName = updates.displayName.trim();
  if (updates.ctApiUrl !== undefined) {
    const apiUrl = sanitizeCtApiOriginForProjectPaths(updates.ctApiUrl.trim());
    set.ctApiUrl = apiUrl;
    set["credentials.commercetools.apiUrl"] = apiUrl;
  }
  if (updates.ctAuthUrl !== undefined) {
    const authUrl = updates.ctAuthUrl.trim().replace(/\/$/, "");
    set.ctAuthUrl = authUrl;
    set["credentials.commercetools.authUrl"] = authUrl;
  }
  if (updates.ctClientId !== undefined) {
    const clientId = updates.ctClientId.trim();
    set.ctClientId = clientId;
    set["credentials.commercetools.clientId"] = clientId;
  }
  if (updates.ctClientSecret !== undefined) {
    const enc = encrypt(updates.ctClientSecret);
    set.ctClientSecretEncrypted = enc;
    set["credentials.commercetools.clientSecretEncrypted"] = enc;
  }
  if (updates.scopes !== undefined) {
    const scopes = updates.scopes.trim() || undefined;
    set.scopes = scopes;
    set["credentials.commercetools.scopes"] = scopes;
  }
  if (updates.shopifyStoreDomain !== undefined) {
    set["credentials.shopify.storeDomain"] = updates.shopifyStoreDomain.trim();
  }
  if (updates.shopifyAdminAccessToken !== undefined) {
    set["credentials.shopify.adminAccessTokenEncrypted"] = encrypt(updates.shopifyAdminAccessToken);
  }
  if (updates.shopifyApiVersion !== undefined) {
    set["credentials.shopify.apiVersion"] = updates.shopifyApiVersion.trim();
  }
  if (updates.bigcommerceStoreHash !== undefined) {
    set["credentials.bigcommerce.storeHash"] = updates.bigcommerceStoreHash.trim();
  }
  if (updates.bigcommerceClientId !== undefined) {
    set["credentials.bigcommerce.clientId"] = updates.bigcommerceClientId.trim();
  }
  if (updates.bigcommerceAccessToken !== undefined) {
    set["credentials.bigcommerce.accessTokenEncrypted"] = encrypt(updates.bigcommerceAccessToken);
  }

  const unset: Record<string, true> = {};
  if (updates.smtpProfileId !== undefined) {
    if (updates.smtpProfileId === null || updates.smtpProfileId === "") {
      unset.smtpProfileId = true;
    } else {
      set.smtpProfileId = updates.smtpProfileId.trim();
    }
  }
  if (updates.standaloneB2cEnabled !== undefined) set.standaloneB2cEnabled = updates.standaloneB2cEnabled;
  if (updates.standaloneB2bEnabled !== undefined) set.standaloneB2bEnabled = updates.standaloneB2bEnabled;

  const updateDoc: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length) updateDoc.$unset = unset;

  return projects.updateById(id, updateDoc);
}

/**
 * Tenant-scoped delete: removes the project ONLY when it belongs to `clientId`
 * (`{ _id, clientId }`). The safe default — prevents a client-bound caller from
 * deleting another tenant's project by id. Superadmin/cross-client deletes must
 * use `deleteProjectAnyClient` explicitly.
 */
export async function deleteProject(id: string, clientId: string): Promise<boolean> {
  return projects.deleteById(id, { clientId });
}

/**
 * UNSCOPED delete by id — deletes across all tenants. ONLY for
 * superadmin-gated flows where cross-client scope is already enforced upstream.
 */
export async function deleteProjectAnyClient(id: string): Promise<boolean> {
  return projects.deleteById(id);
}

export async function deleteProjectsByClient(clientId: string): Promise<number> {
  const col = await getProjectsCollection();
  const result = await col.deleteMany({ clientId });
  return result.deletedCount;
}

export async function ensureProjectsIndex(): Promise<void> {
  const col = await getProjectsCollection();
  await col.createIndex({ clientId: 1, projectKey: 1 });
  await col.createIndex({ projectKey: 1 });
}
