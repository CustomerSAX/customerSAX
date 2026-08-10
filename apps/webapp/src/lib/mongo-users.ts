/**
 * MongoDB CRUD for CSA users (csa_users collection) — the superadmin's
 * per-client "Users" tab.
 *
 * IMPORTANT: this is the exact collection apps/auth reads at login (see
 * apps/auth/src/users/types.ts's `AuthUser` and apps/auth/src/db/mongodb.ts).
 * This module intentionally does not re-implement or duplicate auth — it
 * only writes/reads documents shaped exactly like AuthUser, using the same
 * bcrypt password hashing the auth service verifies with, so any user
 * created/edited here can log in through the real /login flow unchanged.
 *
 * Real, already-existing users in this collection were provisioned before
 * `tenantId` existed on AuthUser — they carry only a `projectKey` (e.g.
 * "rc_b2b_shop_july_2023"), which is how the client they belong to is
 * actually derivable: via the csa_projects document whose projectKey
 * matches, not a direct tenantId FK. So "users belonging to a client" is
 * resolved as `tenantId === clientId` OR `projectKey ∈ {that client's real
 * project keys}` — matching real data, not just newly-created rows. New
 * writes from this module still set tenantId, since that's the shape the
 * live AuthUser type declares.
 *
 * Real `role` values also aren't limited to the AuthRole enum (agent/admin/
 * superadmin) — some pre-existing accounts carry roles like "supervisor" or
 * "customer_admin" from before this superadmin console existed. Reads keep
 * whatever string is actually stored rather than coercing it, and edits
 * never overwrite role/projectKey unless the caller explicitly changes
 * them, so managing an existing account can't silently clobber a
 * non-standard real value.
 *
 * Collection: MONGO_AGENTS_DB / MONGO_USERS_COLLECTION (default csa-agents / csa_users)
 */

import bcrypt from 'bcryptjs';
import { ObjectId } from '@csa/mongodb';
import { getUsersCollection, getProjectsCollection } from '@/lib/db';

const BCRYPT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Types — mirrors apps/auth/src/users/types.ts's AuthUser, but with `role`
// and `tenantId` widened since real stored documents don't all conform to
// the narrower type that file declares (see module doc comment above).
// ---------------------------------------------------------------------------

export interface CsaUser {
  _id: ObjectId;
  id: string;
  active: boolean;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  passwordHash: string;
  projectKey?: string;
  role: string;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CsaUserPublic = Omit<CsaUser, '_id' | 'passwordHash'>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPublic(doc: CsaUser): CsaUserPublic {
  const { _id, passwordHash: _hash, ...rest } = doc;
  void _hash;
  return rest;
}

function displayName(firstName?: string, lastName?: string, fallbackEmail?: string): string {
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joined || fallbackEmail || '';
}

/** Real project keys belonging to a client, per the live csa_projects collection. */
async function projectKeysForClient(clientId: string): Promise<string[]> {
  const col = await getProjectsCollection<{ clientId: string; projectKey: string }>();
  const docs = await col.find({ clientId }).project({ projectKey: 1 }).toArray();
  return docs.map((d) => d.projectKey).filter((k): k is string => Boolean(k));
}

/** Query matching every user that actually belongs to a client — see module doc comment. */
async function membershipQuery(clientId: string): Promise<Record<string, unknown>> {
  const projectKeys = await projectKeysForClient(clientId);
  return projectKeys.length > 0
    ? { $or: [{ tenantId: clientId }, { projectKey: { $in: projectKeys } }] }
    : { tenantId: clientId };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Lists every user belonging to a client, sorted by email. */
export async function listUsersByClient(clientId: string): Promise<CsaUserPublic[]> {
  const col = await getUsersCollection<CsaUser>();
  const docs = await col.find(await membershipQuery(clientId)).sort({ email: 1 }).toArray();
  return docs.map(toPublic);
}

/** Counts users belonging to a client. */
export async function countUsersByClient(clientId: string): Promise<number> {
  const col = await getUsersCollection<CsaUser>();
  return col.countDocuments(await membershipQuery(clientId));
}

/** Finds a user by email (any tenant) — used for lookups before create/assign. */
export async function findUserByEmail(email: string): Promise<CsaUserPublic | null> {
  const col = await getUsersCollection<CsaUser>();
  const doc = await col.findOne({ email: email.trim().toLowerCase() });
  return doc ? toPublic(doc) : null;
}

/** Finds a user by id, scoped to a client (defense against cross-tenant edits/deletes). */
export async function findUserByIdForClient(id: string, clientId: string): Promise<CsaUserPublic | null> {
  const col = await getUsersCollection<CsaUser>();
  let oid: ObjectId | undefined;
  try {
    oid = new ObjectId(id);
  } catch {
    oid = undefined;
  }
  const idOr: Record<string, unknown>[] = [{ id }];
  if (oid) idOr.push({ _id: oid });

  const membership = await membershipQuery(clientId);
  const doc = await col.findOne({ $and: [membership, { $or: idOr }] });
  return doc ? toPublic(doc) : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Creates a new user scoped to a client. Writes an AuthUser-shaped document
 * so the real /login flow can authenticate it immediately — no separate
 * "activation" step.
 */
export async function createUser(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId: string;
  projectKey?: string;
}): Promise<CsaUserPublic> {
  const col = await getUsersCollection<CsaUser>();
  const email = data.email.trim().toLowerCase();

  const existing = await col.findOne({ email });
  if (existing) {
    throw new Error(`A user with email '${email}' already exists`);
  }

  const _id = new ObjectId();
  const now = new Date();
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const doc: CsaUser = {
    _id,
    id: _id.toHexString(),
    active: true,
    email,
    firstName: data.firstName?.trim() || undefined,
    lastName: data.lastName?.trim() || undefined,
    name: displayName(data.firstName, data.lastName, email),
    passwordHash,
    projectKey: data.projectKey?.trim() || undefined,
    role: data.role,
    tenantId: data.tenantId,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc);
  return toPublic(doc);
}

/**
 * Moves an existing user (found by email, any current tenant) into this
 * client — the real schema is single-tenant-per-user, so "assigning" a
 * user to a client reassigns them, it does not add a second membership.
 */
export async function assignExistingUserToClient(data: {
  email: string;
  tenantId: string;
  role: string;
  projectKey?: string;
}): Promise<CsaUserPublic | null> {
  const col = await getUsersCollection<CsaUser>();
  const email = data.email.trim().toLowerCase();
  const existing = await col.findOne({ email });
  if (!existing) return null;

  const set: Record<string, unknown> = {
    tenantId: data.tenantId,
    role: data.role,
    updatedAt: new Date(),
  };
  if (data.projectKey !== undefined) set.projectKey = data.projectKey.trim() || undefined;

  await col.updateOne({ _id: existing._id }, { $set: set });
  const updated = await col.findOne({ _id: existing._id });
  return updated ? toPublic(updated) : null;
}

/**
 * Updates a user's profile/role/project/active fields. Scoped to the given
 * client. Only touches role/projectKey/active/password when the caller
 * explicitly passes them — editing a real user's name never silently
 * resets an existing non-standard role or unlinks their real project.
 */
export async function updateUser(
  id: string,
  clientId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    role?: string;
    projectKey?: string | null;
    active?: boolean;
    password?: string;
  }
): Promise<boolean> {
  const col = await getUsersCollection<CsaUser>();
  const existing = await findUserByIdForClient(id, clientId);
  if (!existing) return false;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  const nextFirst = updates.firstName !== undefined ? updates.firstName.trim() || undefined : existing.firstName;
  const nextLast = updates.lastName !== undefined ? updates.lastName.trim() || undefined : existing.lastName;
  if (updates.firstName !== undefined) set.firstName = nextFirst;
  if (updates.lastName !== undefined) set.lastName = nextLast;
  if (updates.firstName !== undefined || updates.lastName !== undefined) {
    set.name = displayName(nextFirst, nextLast, existing.email);
  }
  if (updates.role !== undefined) set.role = updates.role;
  if (updates.projectKey !== undefined) {
    set.projectKey = updates.projectKey === null || updates.projectKey === '' ? undefined : updates.projectKey.trim();
  }
  if (updates.active !== undefined) set.active = updates.active;
  if (updates.password) {
    set.passwordHash = await bcrypt.hash(updates.password, BCRYPT_ROUNDS);
  }

  const oid = new ObjectId(existing.id);
  const result = await col.updateOne({ _id: oid }, { $set: set });
  return result.matchedCount > 0;
}

/** Permanently deletes a user (scoped to the client, to avoid cross-tenant deletes). */
export async function deleteUserForClient(id: string, clientId: string): Promise<boolean> {
  const existing = await findUserByIdForClient(id, clientId);
  if (!existing) return false;
  const col = await getUsersCollection<CsaUser>();
  const oid = new ObjectId(existing.id);
  const result = await col.deleteOne({ _id: oid });
  return result.deletedCount > 0;
}

/** Deactivates every user belonging to a client (used when a client is deleted) — never deletes real accounts. */
export async function deactivateUsersByClient(clientId: string): Promise<number> {
  const col = await getUsersCollection<CsaUser>();
  const result = await col.updateMany(await membershipQuery(clientId), {
    $set: { active: false, updatedAt: new Date() },
  });
  return result.modifiedCount;
}

/** Ensures the unique index on email exists — matches apps/auth's own index. Safe to call repeatedly. */
export async function ensureUsersIndex(): Promise<void> {
  const col = await getUsersCollection<CsaUser>();
  await col.createIndex({ email: 1 }, { unique: true });
}
