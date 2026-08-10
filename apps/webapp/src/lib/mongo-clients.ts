/**
 * MongoDB CRUD for CSA client organisations (csa_clients collection).
 *
 * A "client" is a customer organisation that uses the CSA platform. Each
 * client can have multiple commerce projects (see mongo-projects.ts) and
 * multiple admin/agent users scoped to it via AuthUser.tenantId (see
 * mongo-users.ts) — this collection is the canonical registry those
 * tenantId values point at.
 *
 * Collection location:
 *   DB   : MONGO_ADMIN_DB  (default: csa-admin)
 *   Coll : MONGO_ADMIN_COLLECTION (default: csa_clients)
 */

import { ObjectId } from '@csa/mongodb';
import { getClientsCollection } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientStatus = 'active' | 'blocked';

/** Per-tenant SSO — stored only on `csa_clients` (superadmin-managed). */
export type ClientSsoProviderKind = 'none' | 'oidc' | 'saml';

/** OpenID Connect (OAuth 2.0) IdP — used for per-client /sign-in discovery. */
export interface ClientSsoOidcStored {
  provider: 'oidc';
  /** OIDC issuer base URL (must expose /.well-known/openid-configuration) */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Button label on /sign-in, e.g. "Contoso Azure AD" */
  providerDisplayName?: string;
  /** Space-separated extra scopes (always includes openid email profile) */
  extraScopes?: string;
  /** Sent as authorize URL query param `connection` when set (Auth0 DB or enterprise connection name). */
  authorizeConnection?: string;
}

/** SAML 2.0 IdP — configuration stored for superadmin; runtime login hook is not wired yet. */
export interface ClientSsoSamlStored {
  provider: 'saml';
  entryPointUrl: string;
  /** IdP entity / audience identifier */
  issuer: string;
  /** PEM x509 certificate from the IdP */
  idpCertPem: string;
}

export type ClientSsoConfigStored = { provider: 'none' } | ClientSsoOidcStored | ClientSsoSamlStored;

/** API-safe SSO view (no secrets). */
export type ClientSsoConfigPublic =
  | { provider: 'none' }
  | {
      provider: 'oidc';
      issuer: string;
      clientId: string;
      providerDisplayName?: string;
      extraScopes?: string;
      authorizeConnection?: string;
      oidcClientSecretSet: boolean;
    }
  | {
      provider: 'saml';
      entryPointUrl: string;
      issuer: string;
      idpCertSet: boolean;
    };

export interface CsaClient {
  _id: ObjectId;
  /** Display name of the client organisation */
  name: string;
  /** URL-safe unique identifier (auto-derived from name, immutable after creation) */
  slug: string;
  /** Primary contact email for the client */
  contactEmail: string;
  status: ClientStatus;
  /** Optional federated login config for this tenant (OAuth / SAML metadata). */
  ssoConfig?: ClientSsoConfigStored;
  /** Email of the superadmin who created this client */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** CsaClient shape returned to API consumers — ObjectId replaced with string id */
export type CsaClientPublic = Omit<CsaClient, '_id' | 'ssoConfig'> & {
  id: string;
  ssoConfig: ClientSsoConfigPublic;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ssoConfigToPublic(cfg: ClientSsoConfigStored | undefined): ClientSsoConfigPublic {
  if (!cfg || cfg.provider === 'none') {
    return { provider: 'none' };
  }
  if (cfg.provider === 'oidc') {
    return {
      provider: 'oidc',
      issuer: cfg.issuer,
      clientId: cfg.clientId,
      providerDisplayName: cfg.providerDisplayName,
      extraScopes: cfg.extraScopes,
      authorizeConnection: cfg.authorizeConnection,
      oidcClientSecretSet: Boolean(cfg.clientSecret?.trim()),
    };
  }
  return {
    provider: 'saml',
    entryPointUrl: cfg.entryPointUrl,
    issuer: cfg.issuer,
    idpCertSet: Boolean(cfg.idpCertPem?.trim()),
  };
}

function toPublic(doc: CsaClient): CsaClientPublic {
  const { _id, ssoConfig, ...rest } = doc;
  return { id: _id.toHexString(), ...rest, ssoConfig: ssoConfigToPublic(ssoConfig) };
}

/** Reads a client document including sensitive SSO fields (server-only). */
export async function findClientByIdRaw(id: string): Promise<CsaClient | null> {
  const col = await getClientsCollection<CsaClient>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  return col.findOne({ _id: oid });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Returns all clients sorted alphabetically by name. */
export async function listClients(): Promise<CsaClientPublic[]> {
  const col = await getClientsCollection<CsaClient>();
  const docs = await col.find({ name: { $exists: true } }).sort({ name: 1 }).toArray();
  return docs.map(toPublic);
}

/** Finds a client by its MongoDB ObjectId string. */
export async function findClientById(id: string): Promise<CsaClientPublic | null> {
  const col = await getClientsCollection<CsaClient>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await col.findOne({ _id: oid });
  return doc ? toPublic(doc) : null;
}

/** Finds a client by its unique slug. */
export async function findClientBySlug(slug: string): Promise<CsaClientPublic | null> {
  const col = await getClientsCollection<CsaClient>();
  const doc = await col.findOne({ slug: slug.toLowerCase().trim() });
  return doc ? toPublic(doc) : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Creates a new client organisation. */
export async function createClient(data: {
  name: string;
  slug: string;
  contactEmail: string;
  createdBy: string;
}): Promise<CsaClientPublic> {
  const col = await getClientsCollection<CsaClient>();
  const now = new Date();

  const doc: CsaClient = {
    _id: new ObjectId(),
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase().replace(/\s+/g, '-'),
    contactEmail: data.contactEmail.trim().toLowerCase(),
    status: 'active',
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc);
  return toPublic(doc);
}

/** Updates a client's mutable fields (name, contactEmail, ssoConfig). */
export async function updateClient(
  id: string,
  updates: { name?: string; contactEmail?: string; ssoConfig?: ClientSsoConfigStored | null }
): Promise<boolean> {
  const col = await getClientsCollection<CsaClient>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) set.name = updates.name.trim();
  if (updates.contactEmail !== undefined) set.contactEmail = updates.contactEmail.trim().toLowerCase();
  if (updates.ssoConfig !== undefined) {
    set.ssoConfig = updates.ssoConfig === null ? { provider: 'none' as const } : updates.ssoConfig;
  }

  const result = await col.updateOne({ _id: oid }, { $set: set });
  return result.matchedCount > 0;
}

/** Sets the active/blocked status of a client. */
export async function setClientStatus(id: string, status: ClientStatus): Promise<boolean> {
  const col = await getClientsCollection<CsaClient>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await col.updateOne({ _id: oid }, { $set: { status, updatedAt: new Date() } });
  return result.matchedCount > 0;
}

/**
 * Permanently deletes a client. Caller is responsible for cleaning up
 * associated projects, SMTP profiles, and user tenant assignments
 * beforehand (see the DELETE route handler).
 */
export async function deleteClient(id: string): Promise<boolean> {
  const col = await getClientsCollection<CsaClient>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await col.deleteOne({ _id: oid });
  return result.deletedCount > 0;
}

/** Ensures the unique index on slug exists. Safe to call repeatedly. */
export async function ensureClientsIndex(): Promise<void> {
  const col = await getClientsCollection<CsaClient>();
  await col.createIndex({ slug: 1 }, { unique: true });
}
