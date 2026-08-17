/**
 * MongoDB CRUD for per-client SMTP profiles (the `csa_smtp_profiles`
 * collection). Every operation is tenant-scoped by `clientId`, and the SMTP
 * password is encrypted at rest with AES-256-GCM (see ../encrypt.ts) — only
 * {@link getSmtpProfileWithSecretForClient} decrypts it, for the outbound
 * test-send path. Exactly one profile per client may carry `isDefault`.
 */

import { ObjectId } from "mongodb";
import { getSmtpProfilesCollection } from "../admin/db.js";
import { createCollectionAccessor } from "../collection-accessor.js";
import { encrypt, decrypt } from "../encrypt.js";
import type { CsaSmtpProfile } from "./types.js";

/** Shared id-keyed helpers over the `csa_smtp_profiles` collection. */
const smtpProfiles = createCollectionAccessor(getSmtpProfilesCollection);

export function smtpProfileView(doc: CsaSmtpProfile) {
  const { _id, smtpPasswordEncrypted: _enc, ...rest } = doc;
  void _enc;
  return { id: _id.toHexString(), ...rest, smtpPasswordMasked: "••••••••" };
}

export async function ensureSmtpProfilesIndex(): Promise<void> {
  const col = await getSmtpProfilesCollection();
  await col.createIndex({ clientId: 1 });
  await col.createIndex({ clientId: 1, isDefault: 1 });
}

export async function listSmtpProfilesByClient(clientId: string): Promise<CsaSmtpProfile[]> {
  const col = await getSmtpProfilesCollection();
  const docs = await col.find({ clientId }).sort({ name: 1 }).toArray();
  return docs as unknown as CsaSmtpProfile[];
}

export async function findSmtpProfileByIdForClient(profileId: string, clientId: string): Promise<CsaSmtpProfile | null> {
  return (await smtpProfiles.findById(profileId, { clientId })) as CsaSmtpProfile | null;
}

export async function getSmtpProfileWithSecretForClient(
  profileId: string,
  clientId: string
): Promise<(ReturnType<typeof smtpProfileView> & { smtpPassword: string }) | null> {
  const doc = await findSmtpProfileByIdForClient(profileId, clientId);
  if (!doc) return null;
  return { ...smtpProfileView(doc), smtpPassword: decrypt(doc.smtpPasswordEncrypted) };
}

export async function resolveDefaultSmtpProfileId(clientId: string): Promise<string | null> {
  const col = await getSmtpProfilesCollection();
  const def = await col.findOne({ clientId, isDefault: true });
  if (def) return (def._id as ObjectId).toHexString();
  const first = await col.findOne({ clientId }, { sort: { name: 1 } });
  return first ? (first._id as ObjectId).toHexString() : null;
}

async function clearDefaultFlagForClient(clientId: string): Promise<void> {
  const col = await getSmtpProfilesCollection();
  await col.updateMany({ clientId }, { $set: { isDefault: false, updatedAt: new Date() } });
}

export async function createSmtpProfile(data: {
  clientId: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  emailFrom: string;
  isDefault: boolean;
}): Promise<CsaSmtpProfile> {
  await ensureSmtpProfilesIndex();
  const col = await getSmtpProfilesCollection();
  const now = new Date();

  if (data.isDefault) {
    await clearDefaultFlagForClient(data.clientId);
  }

  const doc: CsaSmtpProfile = {
    _id: new ObjectId(),
    clientId: data.clientId,
    name: data.name.trim(),
    smtpHost: data.smtpHost.trim(),
    smtpPort: data.smtpPort,
    smtpSecure: data.smtpSecure,
    smtpUser: data.smtpUser.trim(),
    smtpPasswordEncrypted: encrypt(data.smtpPassword),
    emailFrom: data.emailFrom.trim(),
    isDefault: data.isDefault,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc as never);
  return doc;
}

export async function updateSmtpProfile(
  profileId: string,
  clientId: string,
  updates: {
    name?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    smtpPassword?: string;
    emailFrom?: string;
    isDefault?: boolean;
  }
): Promise<boolean> {
  const existing = await findSmtpProfileByIdForClient(profileId, clientId);
  if (!existing) return false;

  if (updates.isDefault === true) {
    await clearDefaultFlagForClient(clientId);
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) set.name = updates.name.trim();
  if (updates.smtpHost !== undefined) set.smtpHost = updates.smtpHost.trim();
  if (updates.smtpPort !== undefined) set.smtpPort = updates.smtpPort;
  if (updates.smtpSecure !== undefined) set.smtpSecure = updates.smtpSecure;
  if (updates.smtpUser !== undefined) set.smtpUser = updates.smtpUser.trim();
  if (updates.smtpPassword !== undefined && updates.smtpPassword.length > 0) {
    set.smtpPasswordEncrypted = encrypt(updates.smtpPassword);
  }
  if (updates.emailFrom !== undefined) set.emailFrom = updates.emailFrom.trim();
  if (updates.isDefault !== undefined) set.isDefault = updates.isDefault;

  return smtpProfiles.updateById(profileId, { $set: set }, { clientId });
}

export async function deleteSmtpProfile(profileId: string, clientId: string): Promise<boolean> {
  return smtpProfiles.deleteById(profileId, { clientId });
}

export async function deleteSmtpProfilesByClient(clientId: string): Promise<number> {
  const col = await getSmtpProfilesCollection();
  const result = await col.deleteMany({ clientId });
  return result.deletedCount;
}
