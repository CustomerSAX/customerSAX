/**
 * MongoDB CRUD for CSA commerce project configurations (csa_projects
 * collection).
 *
 * Each project belongs to a client and stores the commerce platform API
 * credentials needed to authenticate against it. Secrets are encrypted at
 * rest with AES-256-GCM (see lib/encrypt.ts) and are NEVER returned in the
 * public shape — use getProjectWithSecret() only for internal
 * server-to-server operations (connection tests, token fetches).
 *
 * Collection location:
 *   DB   : MONGO_ADMIN_DB  (default: csa-admin)
 *   Coll : MONGO_PROJECTS_COLLECTION (default: csa_projects)
 */

import { ObjectId } from '@csa/mongodb';
import { getProjectsCollection } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encrypt';

/**
 * CommerceTools REST calls use `{origin}/{projectKey}/…` — the API root
 * must not already include a project segment or `/graphql` (common
 * copy/paste mistakes from Merchant Center / docs).
 */
function sanitizeCtApiOriginForProjectPaths(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    if (/\.commercetools\.com$/i.test(u.hostname)) {
      return u.origin;
    }
  } catch {
    /* fall through — try suffix strip */
  }
  return trimmed.replace(/\/graphql\/?$/i, '').replace(/\/$/, '');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Commerce platform backing a project. Absent on a stored doc ⇒ 'commercetools' (legacy). */
export type CommercePlatform = 'commercetools' | 'shopify' | 'bigcommerce';

/** CommerceTools credentials in the canonical blob. Secret stored AES-256-GCM encrypted. */
export interface StoredCtCredentials {
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecretEncrypted: string;
  scopes?: string;
}

/** Shopify credentials in the canonical blob. Admin token stored AES-256-GCM encrypted. */
export interface StoredShopifyCredentials {
  storeDomain: string;
  adminAccessTokenEncrypted: string;
  apiVersion: string;
}

/** BigCommerce credentials in the canonical blob. Access token stored AES-256-GCM encrypted. */
export interface StoredBigCommerceCredentials {
  storeHash: string;
  clientId: string;
  accessTokenEncrypted: string;
}

/** Platform-tagged credentials blob — the canonical credential store. */
export interface ProjectCredentials {
  commercetools?: StoredCtCredentials;
  shopify?: StoredShopifyCredentials;
  bigcommerce?: StoredBigCommerceCredentials;
}

export interface CsaProject {
  _id: ObjectId;
  /** hex ObjectId string referencing the parent CsaClient */
  clientId: string;
  /** Commerce platform; absent ⇒ 'commercetools' (legacy rows). */
  platform?: CommercePlatform;
  /** Canonical platform-tagged credentials. Falls back to the flat `ct*` fields when absent. */
  credentials?: ProjectCredentials;
  /** CommerceTools project key */
  projectKey: string;
  /** Human-readable label shown in the UI */
  displayName: string;
  /** CT REST API base URL — legacy flat field (kept during the blob transition) */
  ctApiUrl: string;
  /** CT OAuth token URL — legacy flat field */
  ctAuthUrl: string;
  /** CT API client ID — legacy flat field */
  ctClientId: string;
  /** AES-256-GCM encrypted CT client secret — legacy flat field */
  ctClientSecretEncrypted: string;
  /** CT OAuth scopes — defaults to manage_project:{projectKey} when absent */
  scopes?: string;
  /** Optional hex id of CsaSmtpProfile for outbound email; if unset, client's default profile is used. */
  smtpProfileId?: string;
  /** When not `false`, the B2C workspace shell may be exposed for this project. */
  standaloneB2cEnabled?: boolean;
  /** When `true`, the B2B workspace shell may be exposed for this project (default off). */
  standaloneB2bEnabled?: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Safe shape returned to API consumers — no secret, secret replaced with masked display string */
export type CsaProjectPublic = Omit<
  CsaProject,
  '_id' | 'ctClientSecretEncrypted' | 'credentials' | 'platform'
> & {
  id: string;
  platform: CommercePlatform;
  /** Masked version of the client secret, e.g. "abc••••••xyz" */
  ctClientSecretMasked: string;
  shopifyStoreDomain?: string;
  shopifyApiVersion?: string;
  bigcommerceStoreHash?: string;
  bigcommerceClientId?: string;
};

export type CsaProjectWithSecret = CsaProjectPublic & {
  ctClientSecret?: string;
  shopifyAdminAccessToken?: string;
  bigcommerceAccessToken?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskSecret(secret: string): string {
  if (!secret) return '••••••••';
  if (secret.length <= 6) return '••••••••';
  return `${secret.slice(0, 3)}••••••••${secret.slice(-3)}`;
}

function projectPlatform(doc: CsaProject): CommercePlatform {
  return doc.platform ?? 'commercetools';
}

/**
 * Resolves CT credential fields blob-first, flat-fallback. Rows written before the
 * blob existed have only the flat `ct*` fields; new rows carry both (dual-written).
 */
function ctCredsView(doc: CsaProject): {
  ctApiUrl: string;
  ctAuthUrl: string;
  ctClientId: string;
  ctClientSecretEncrypted: string;
  scopes?: string;
} {
  const c = doc.credentials?.commercetools;
  return {
    ctApiUrl: c?.apiUrl ?? doc.ctApiUrl ?? '',
    ctAuthUrl: c?.authUrl ?? doc.ctAuthUrl ?? '',
    ctClientId: c?.clientId ?? doc.ctClientId ?? '',
    ctClientSecretEncrypted: c?.clientSecretEncrypted ?? doc.ctClientSecretEncrypted ?? '',
    scopes: c?.scopes ?? doc.scopes,
  };
}

function toPublic(doc: CsaProject): CsaProjectPublic {
  const { _id, ctClientSecretEncrypted: _enc, credentials: _creds, platform: _p, ...rest } = doc;
  const ct = ctCredsView(doc);
  let maskedSecret = '••••••••';
  try {
    maskedSecret = maskSecret(decrypt(ct.ctClientSecretEncrypted));
  } catch {
    // Decryption may fail if the key changed — keep masked placeholder
  }
  return {
    id: _id.toHexString(),
    ...rest,
    platform: projectPlatform(doc),
    ctApiUrl: ct.ctApiUrl,
    ctAuthUrl: ct.ctAuthUrl,
    ctClientId: ct.ctClientId,
    scopes: ct.scopes,
    ctClientSecretMasked: maskedSecret,
    shopifyStoreDomain: doc.credentials?.shopify?.storeDomain,
    shopifyApiVersion: doc.credentials?.shopify?.apiVersion,
    bigcommerceStoreHash: doc.credentials?.bigcommerce?.storeHash,
    bigcommerceClientId: doc.credentials?.bigcommerce?.clientId,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Returns all projects belonging to the given client, sorted by projectKey. */
export async function listProjectsByClient(clientId: string): Promise<CsaProjectPublic[]> {
  const col = await getProjectsCollection<CsaProject>();
  const docs = await col.find({ clientId }).sort({ projectKey: 1 }).toArray();
  return docs.map(toPublic);
}

/** Finds a single project by its MongoDB id. */
export async function findProjectById(id: string): Promise<CsaProjectPublic | null> {
  const col = await getProjectsCollection<CsaProject>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await col.findOne({ _id: oid });
  return doc ? toPublic(doc) : null;
}

/**
 * Returns the project with its decrypted secret by Mongo document id.
 * ONLY use this for internal server-to-server operations (e.g. connection
 * tests). Never expose the result to API consumers.
 */
export async function getProjectWithSecret(id: string): Promise<CsaProjectWithSecret | null> {
  const col = await getProjectsCollection<CsaProject>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await col.findOne({ _id: oid });
  if (!doc) return null;

  const pub = toPublic(doc);
  const ctClientSecret =
    doc.platform !== 'shopify' && doc.platform !== 'bigcommerce' && ctCredsView(doc).ctClientSecretEncrypted
      ? decrypt(ctCredsView(doc).ctClientSecretEncrypted)
      : undefined;
  const shopifyAdminAccessToken =
    doc.platform === 'shopify' && doc.credentials?.shopify?.adminAccessTokenEncrypted
      ? decrypt(doc.credentials.shopify.adminAccessTokenEncrypted)
      : undefined;
  const bigcommerceAccessToken =
    doc.platform === 'bigcommerce' && doc.credentials?.bigcommerce?.accessTokenEncrypted
      ? decrypt(doc.credentials.bigcommerce.accessTokenEncrypted)
      : undefined;
  return { ...pub, ctClientSecret, shopifyAdminAccessToken, bigcommerceAccessToken };
}

/** Returns the count of projects belonging to a client. */
export async function countProjectsByClient(clientId: string): Promise<number> {
  const col = await getProjectsCollection<CsaProject>();
  return col.countDocuments({ clientId });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Adds a new commerce project under the given client. Secrets are encrypted
 * before storage.
 */
export async function createProject(data: {
  clientId: string;
  platform?: CommercePlatform;
  projectKey: string;
  displayName: string;
  // CommerceTools credentials (required when platform = 'commercetools').
  ctApiUrl?: string;
  ctAuthUrl?: string;
  ctClientId?: string;
  ctClientSecret?: string;
  scopes?: string;
  // Shopify credentials (required when platform = 'shopify').
  shopifyStoreDomain?: string;
  shopifyAdminAccessToken?: string;
  shopifyApiVersion?: string;
  // BigCommerce credentials (required when platform = 'bigcommerce').
  bigcommerceStoreHash?: string;
  bigcommerceClientId?: string;
  bigcommerceAccessToken?: string;
  createdBy: string;
  standaloneB2cEnabled?: boolean;
  standaloneB2bEnabled?: boolean;
}): Promise<CsaProjectPublic> {
  const col = await getProjectsCollection<CsaProject>();
  const now = new Date();
  const platform: CommercePlatform = data.platform ?? 'commercetools';

  let credentials: ProjectCredentials;
  let ctApiUrl = '';
  let ctAuthUrl = '';
  let ctClientId = '';
  let ctClientSecretEncrypted = '';
  let scopes: string | undefined;

  if (platform === 'shopify') {
    const storeDomain = (data.shopifyStoreDomain ?? '').trim();
    const apiVersion = (data.shopifyApiVersion ?? '').trim();
    const token = data.shopifyAdminAccessToken ?? '';
    if (!storeDomain || !apiVersion || !token.trim()) {
      throw new Error('Shopify projects require a store domain, API version, and admin access token.');
    }
    credentials = { shopify: { storeDomain, adminAccessTokenEncrypted: encrypt(token), apiVersion } };
  } else if (platform === 'bigcommerce') {
    const storeHash = (data.bigcommerceStoreHash ?? '').trim();
    const clientId = (data.bigcommerceClientId ?? '').trim();
    const token = data.bigcommerceAccessToken ?? '';
    if (!storeHash || !clientId || !token.trim()) {
      throw new Error('BigCommerce projects require a store hash, client ID, and access token.');
    }
    credentials = { bigcommerce: { storeHash, clientId, accessTokenEncrypted: encrypt(token) } };
  } else {
    ctApiUrl = sanitizeCtApiOriginForProjectPaths((data.ctApiUrl ?? '').trim());
    ctAuthUrl = (data.ctAuthUrl ?? '').trim().replace(/\/$/, '');
    ctClientId = (data.ctClientId ?? '').trim();
    if (!ctApiUrl || !ctAuthUrl || !ctClientId || !data.ctClientSecret) {
      throw new Error('CommerceTools projects require an API URL, Auth URL, client id, and client secret.');
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

  await col.insertOne(doc);
  return toPublic(doc);
}

/**
 * Updates mutable fields of a project. CT credential edits are dual-written
 * (flat field + canonical blob field) so blob-first readers stay correct.
 */
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
  const col = await getProjectsCollection<CsaProject>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.displayName !== undefined) set.displayName = updates.displayName.trim();
  if (updates.ctApiUrl !== undefined) {
    const apiUrl = sanitizeCtApiOriginForProjectPaths(updates.ctApiUrl.trim());
    set.ctApiUrl = apiUrl;
    set['credentials.commercetools.apiUrl'] = apiUrl;
  }
  if (updates.ctAuthUrl !== undefined) {
    const authUrl = updates.ctAuthUrl.trim().replace(/\/$/, '');
    set.ctAuthUrl = authUrl;
    set['credentials.commercetools.authUrl'] = authUrl;
  }
  if (updates.ctClientId !== undefined) {
    const clientId = updates.ctClientId.trim();
    set.ctClientId = clientId;
    set['credentials.commercetools.clientId'] = clientId;
  }
  if (updates.ctClientSecret !== undefined) {
    const enc = encrypt(updates.ctClientSecret);
    set.ctClientSecretEncrypted = enc;
    set['credentials.commercetools.clientSecretEncrypted'] = enc;
  }
  if (updates.scopes !== undefined) {
    const scopes = updates.scopes.trim() || undefined;
    set.scopes = scopes;
    set['credentials.commercetools.scopes'] = scopes;
  }
  if (updates.shopifyStoreDomain !== undefined) {
    set['credentials.shopify.storeDomain'] = updates.shopifyStoreDomain.trim();
  }
  if (updates.shopifyAdminAccessToken !== undefined) {
    set['credentials.shopify.adminAccessTokenEncrypted'] = encrypt(updates.shopifyAdminAccessToken);
  }
  if (updates.shopifyApiVersion !== undefined) {
    set['credentials.shopify.apiVersion'] = updates.shopifyApiVersion.trim();
  }
  if (updates.bigcommerceStoreHash !== undefined) {
    set['credentials.bigcommerce.storeHash'] = updates.bigcommerceStoreHash.trim();
  }
  if (updates.bigcommerceClientId !== undefined) {
    set['credentials.bigcommerce.clientId'] = updates.bigcommerceClientId.trim();
  }
  if (updates.bigcommerceAccessToken !== undefined) {
    set['credentials.bigcommerce.accessTokenEncrypted'] = encrypt(updates.bigcommerceAccessToken);
  }

  const unset: Record<string, true> = {};
  if (updates.smtpProfileId !== undefined) {
    if (updates.smtpProfileId === null || updates.smtpProfileId === '') {
      unset.smtpProfileId = true;
    } else {
      set.smtpProfileId = updates.smtpProfileId.trim();
    }
  }
  if (updates.standaloneB2cEnabled !== undefined) set.standaloneB2cEnabled = updates.standaloneB2cEnabled;
  if (updates.standaloneB2bEnabled !== undefined) set.standaloneB2bEnabled = updates.standaloneB2bEnabled;

  const updateDoc: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length) updateDoc.$unset = unset;

  // The $set/$unset paths above are built dynamically (dotted credential
  // sub-fields) — not worth re-deriving a precise UpdateFilter<CsaProject>
  // type for, hence the cast at the actual driver call boundary.
  const result = await col.updateOne({ _id: oid }, updateDoc as never);
  return result.matchedCount > 0;
}

/** Permanently removes a project from a client. */
export async function deleteProject(id: string): Promise<boolean> {
  const col = await getProjectsCollection<CsaProject>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await col.deleteOne({ _id: oid });
  return result.deletedCount > 0;
}

/** Removes all projects belonging to a client — used when deleting a client. */
export async function deleteProjectsByClient(clientId: string): Promise<number> {
  const col = await getProjectsCollection<CsaProject>();
  const result = await col.deleteMany({ clientId });
  return result.deletedCount;
}

/** Ensures compound indexes exist on clientId and projectKey. */
export async function ensureProjectsIndex(): Promise<void> {
  const col = await getProjectsCollection<CsaProject>();
  await col.createIndex({ clientId: 1, projectKey: 1 });
  await col.createIndex({ projectKey: 1 });
}
