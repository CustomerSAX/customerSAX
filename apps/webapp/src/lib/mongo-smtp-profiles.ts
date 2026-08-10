/**
 * MongoDB CRUD for per-client SMTP profiles (csa_smtp_profiles).
 *
 * Passwords are encrypted at rest with the same AES-256-GCM helper as CT secrets.
 *
 * Collection: MONGO_ADMIN_DB / MONGO_SMTP_PROFILES_COLLECTION (default csa_smtp_profiles)
 */

import { ObjectId } from '@csa/mongodb';
import { getSmtpProfilesCollection } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encrypt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsaSmtpProfile {
  _id: ObjectId;
  /** Parent CsaClient hex id */
  clientId: string;
  /** Admin-visible label */
  name: string;
  smtpHost: string;
  smtpPort: number;
  /** When true, Nodemailer uses TLS (typical for port 465) */
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordEncrypted: string;
  /** Full From header, e.g. Support <noreply@example.com> */
  emailFrom: string;
  /** At most one default profile per client; used when a project has no smtpProfileId */
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CsaSmtpProfilePublic = Omit<CsaSmtpProfile, '_id' | 'smtpPasswordEncrypted'> & {
  id: string;
  smtpPasswordMasked: string;
};

// ---------------------------------------------------------------------------

function maskPass(): string {
  return '••••••••';
}

function toPublic(doc: CsaSmtpProfile): CsaSmtpProfilePublic {
  const { _id, smtpPasswordEncrypted: _ignored, ...rest } = doc;
  void _ignored;
  return {
    id: _id.toHexString(),
    ...rest,
    smtpPasswordMasked: maskPass(),
  };
}

/** Ensures indexes for smtp profile queries. */
export async function ensureSmtpProfilesIndex(): Promise<void> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  await col.createIndex({ clientId: 1 });
  await col.createIndex({ clientId: 1, isDefault: 1 });
}

/** Lists SMTP profiles for a client, sorted by name. */
export async function listSmtpProfilesByClient(clientId: string): Promise<CsaSmtpProfilePublic[]> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  const docs = await col.find({ clientId }).sort({ name: 1 }).toArray();
  return docs.map(toPublic);
}

/** Finds a profile by id and ensures it belongs to the given client. */
export async function findSmtpProfileByIdForClient(
  profileId: string,
  clientId: string
): Promise<CsaSmtpProfilePublic | null> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(profileId);
  } catch {
    return null;
  }
  const doc = await col.findOne({ _id: oid, clientId });
  return doc ? toPublic(doc) : null;
}

/** Internal: load profile with decrypted SMTP password for outbound email (server-only). */
export async function getSmtpProfileWithSecretForClient(
  profileId: string,
  clientId: string
): Promise<(CsaSmtpProfilePublic & { smtpPassword: string }) | null> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(profileId);
  } catch {
    return null;
  }
  const doc = await col.findOne({ _id: oid, clientId });
  if (!doc) return null;
  const pub = toPublic(doc);
  const smtpPassword = decrypt(doc.smtpPasswordEncrypted);
  return { ...pub, smtpPassword };
}

/** Picks default profile id for a client, or the first profile if none marked default. */
export async function resolveDefaultSmtpProfileId(clientId: string): Promise<string | null> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  const def = await col.findOne({ clientId, isDefault: true });
  if (def) return def._id.toHexString();
  const first = await col.findOne({ clientId }, { sort: { name: 1 } });
  return first ? first._id.toHexString() : null;
}

async function clearDefaultFlagForClient(clientId: string): Promise<void> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  await col.updateMany({ clientId }, { $set: { isDefault: false, updatedAt: new Date() } });
}

/** Creates an SMTP profile. */
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
}): Promise<CsaSmtpProfilePublic> {
  await ensureSmtpProfilesIndex();
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
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

  await col.insertOne(doc);
  return toPublic(doc);
}

/** Updates an SMTP profile. Omit smtpPassword to leave the stored secret unchanged. */
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
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(profileId);
  } catch {
    return false;
  }

  const existing = await col.findOne({ _id: oid, clientId });
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

  const result = await col.updateOne({ _id: oid, clientId }, { $set: set });
  return result.matchedCount > 0;
}

/** Deletes a profile. Callers should clear project.smtpProfileId references if needed. */
export async function deleteSmtpProfile(profileId: string, clientId: string): Promise<boolean> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  let oid: ObjectId;
  try {
    oid = new ObjectId(profileId);
  } catch {
    return false;
  }
  const result = await col.deleteOne({ _id: oid, clientId });
  return result.deletedCount > 0;
}

/** Removes all SMTP profiles for a client (e.g. when deleting the client). */
export async function deleteSmtpProfilesByClient(clientId: string): Promise<number> {
  const col = await getSmtpProfilesCollection<CsaSmtpProfile>();
  const result = await col.deleteMany({ clientId });
  return result.deletedCount;
}
