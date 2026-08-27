/**
 * MongoDB CRUD for CSA client organisations. Moved here from the studio so
 * the studio never talks to Mongo directly — see this repo's established
 * pattern (studio -> BFF -> subgraph -> real backend), the same one
 * apps/ticketing already follows.
 */

import { ObjectId } from "mongodb";
import { getClientsCollection } from "../admin/db.js";
import { createCollectionAccessor } from "../collection-accessor.js";
import { encryptSsoConfigSecrets } from "./sso-secrets.js";
import type { CsaClient, ClientStatus, ClientSsoConfigStored } from "./types.js";

/** Shared id-keyed helpers over the `csa_clients` collection. */
const clients = createCollectionAccessor(getClientsCollection);

function ssoConfigView(cfg: ClientSsoConfigStored | undefined) {
  if (!cfg || cfg.provider === "none") {
    return { provider: "none" as const };
  }
  if (cfg.provider === "oidc") {
    return {
      provider: "oidc" as const,
      issuer: cfg.issuer,
      clientId: cfg.clientId,
      providerDisplayName: cfg.providerDisplayName,
      extraScopes: cfg.extraScopes,
      authorizeConnection: cfg.authorizeConnection,
      oidcClientSecretSet: Boolean(cfg.clientSecret?.trim()),
    };
  }
  return {
    provider: "saml" as const,
    entryPointUrl: cfg.entryPointUrl,
    issuer: cfg.issuer,
    idpCertSet: Boolean(cfg.idpCertPem?.trim()),
  };
}

export function clientView(doc: CsaClient) {
  const { _id, ssoConfig, ...rest } = doc;
  return { id: _id.toHexString(), ...rest, ssoConfig: ssoConfigView(ssoConfig) };
}

export async function findClientByIdRaw(id: string): Promise<CsaClient | null> {
  return (await clients.findById(id)) as CsaClient | null;
}

export async function listClients(): Promise<CsaClient[]> {
  const col = await getClientsCollection();
  const docs = await col.find({ name: { $exists: true } }).sort({ name: 1 }).toArray();
  return docs as unknown as CsaClient[];
}

export async function findClientById(id: string): Promise<CsaClient | null> {
  return findClientByIdRaw(id);
}

export async function findClientBySlug(slug: string): Promise<CsaClient | null> {
  const col = await getClientsCollection();
  const doc = await col.findOne({ slug: slug.toLowerCase().trim() });
  return doc as CsaClient | null;
}

export async function createClient(data: {
  name: string;
  slug: string;
  contactEmail: string;
  createdBy: string;
}): Promise<CsaClient> {
  const col = await getClientsCollection();
  const now = new Date();

  const doc: CsaClient = {
    _id: new ObjectId(),
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase().replace(/\s+/g, "-"),
    contactEmail: data.contactEmail.trim().toLowerCase(),
    status: "active",
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc as never);
  return doc;
}

export async function updateClient(
  id: string,
  updates: { name?: string; contactEmail?: string; ssoConfig?: ClientSsoConfigStored | null }
): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) set.name = updates.name.trim();
  if (updates.contactEmail !== undefined) set.contactEmail = updates.contactEmail.trim().toLowerCase();
  if (updates.ssoConfig !== undefined) {
    // Encrypt the secret fields (OIDC clientSecret / SAML idpCertPem) at rest.
    // The incoming value carries plaintext secrets (merged from a fresh input
    // or the decrypted previous value in parse-sso-input.ts), so this is the
    // single encrypt boundary — no double-encryption.
    set.ssoConfig =
      updates.ssoConfig === null ? { provider: "none" as const } : encryptSsoConfigSecrets(updates.ssoConfig);
  }

  return clients.updateById(id, { $set: set });
}

export async function setClientStatus(id: string, status: ClientStatus): Promise<boolean> {
  return clients.updateById(id, { $set: { status, updatedAt: new Date() } });
}

export async function deleteClient(id: string): Promise<boolean> {
  return clients.deleteById(id);
}

export async function ensureClientsIndex(): Promise<void> {
  const col = await getClientsCollection();
  await col.createIndex({ slug: 1 }, { unique: true });
}
