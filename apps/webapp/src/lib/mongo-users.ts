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
 * The live schema is single-tenant-per-user (`tenantId` + optional
 * `projectKey`, not an array of memberships) — this module matches that,
 * it does not invent a richer multi-project model the auth service
 * wouldn't understand.
 *
 * Collection: MONGO_AGENTS_DB / MONGO_USERS_COLLECTION (default csa-agents / csa_users)
 */

import bcrypt from 'bcryptjs';
import { ObjectId } from '@csa/mongodb';
import { getUsersCollection } from '@/lib/db';
import type { CsaRole } from '@/constants';

const BCRYPT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Types — mirrors apps/auth/src/users/types.ts's AuthUser exactly
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
  role: CsaRole;
  tenantId: string;
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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Lists every user belonging to a client (tenant), sorted by email. */
export async function listUsersByClient(clientId: string): Promise<CsaUserPublic[]> {
  const col = await getUsersCollection<CsaUser>();
  const docs = await col.find({ tenantId: clientId }).sort({ email: 1 }).toArray();
  return docs.map(toPublic);
}

/** Counts users belonging to a client. */
export async function countUsersByClient(clientId: string): Promise<number> {
  const col = await getUsersCollection<CsaUser>();
  return col.countDocuments({ tenantId: clientId });
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
  const or: Record<string, unknown>[] = [{ id }];
  if (oid) or.push({ _id: oid });
  const doc = await col.findOne({ tenantId: clientId, $or: or });
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
  role: CsaRole;
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
  role: CsaRole;
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

/** Updates a user's profile/role/project/active fields. Scoped to the given client. */
export async function updateUser(
  id: string,
  clientId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    role?: CsaRole;
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
  const result = await col.updateOne({ _id: oid, tenantId: clientId }, { $set: set });
  return result.matchedCount > 0;
}

/** Permanently deletes a user (scoped to the client, to avoid cross-tenant deletes). */
export async function deleteUserForClient(id: string, clientId: string): Promise<boolean> {
  const col = await getUsersCollection<CsaUser>();
  const existing = await findUserByIdForClient(id, clientId);
  if (!existing) return false;
  const oid = new ObjectId(existing.id);
  const result = await col.deleteOne({ _id: oid, tenantId: clientId });
  return result.deletedCount > 0;
}

/** Detaches all of a client's users (used when a client is deleted) — deactivates rather than deletes accounts. */
export async function deactivateUsersByClient(clientId: string): Promise<number> {
  const col = await getUsersCollection<CsaUser>();
  const result = await col.updateMany(
    { tenantId: clientId },
    { $set: { active: false, updatedAt: new Date() } }
  );
  return result.modifiedCount;
}

/** Ensures the unique index on email exists — matches apps/auth's own index. Safe to call repeatedly. */
export async function ensureUsersIndex(): Promise<void> {
  const col = await getUsersCollection<CsaUser>();
  await col.createIndex({ email: 1 }, { unique: true });
}
