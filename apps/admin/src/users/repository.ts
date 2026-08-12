/**
 * MongoDB CRUD for CSA users (csa_users collection) — the superadmin's
 * per-client "Users" tab.
 *
 * IMPORTANT: this is the exact collection apps/auth reads at login. Real,
 * already-existing users carry a `projects: [{projectKey, role, clientId}]`
 * array — that array, not a single tenantId field, is the actual source of
 * truth for "which client(s)/project(s) does this user belong to, and with
 * what role on each". A user can (and in real data, does) belong to
 * multiple clients at once. Writes here also keep the legacy top-level
 * `role`/`projectKey` fields in sync where sensible, since apps/auth's own
 * (narrower) AuthUser type reads those for issuing a session.
 */

import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../db/mongodb.js";
import type { CsaUser, CsaUserProject } from "./types.js";

const BCRYPT_ROUNDS = 12;

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function projectKeysEqual(a: string, b: string): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function userView(doc: CsaUser) {
  const { _id, passwordHash: _hash, ...rest } = doc;
  void _hash;
  return { id: _id.toHexString(), ...rest };
}

/** This client's slice of a user's project memberships — what the per-client Users tab shows. */
export function clientProjectsForUser(user: CsaUser, clientId: string): CsaUserProject[] {
  const list = user.projects ?? [];
  return list.filter((p) => p.clientId === clientId);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<CsaUser | null> {
  const col = await getUsersCollection();
  return (await col.findOne({ email: email.toLowerCase().trim() })) as CsaUser | null;
}

export async function findUserById(id: string): Promise<CsaUser | null> {
  const col = await getUsersCollection();
  const oid = toObjectId(id);
  if (!oid) return null;
  return (await col.findOne({ _id: oid })) as CsaUser | null;
}

/** Every user with at least one projects[] entry for this client (plus legacy top-level clientId rows). */
export async function listUsersByClient(clientId: string): Promise<CsaUser[]> {
  const col = await getUsersCollection();
  const docs = await col
    .find({ $or: [{ "projects.clientId": clientId }, { clientId }] })
    .sort({ email: 1 })
    .toArray();
  return docs as unknown as CsaUser[];
}

export async function countUsersByClient(clientId: string): Promise<number> {
  const col = await getUsersCollection();
  return col.countDocuments({ $or: [{ "projects.clientId": clientId }, { clientId }] });
}

export async function countUsersByProjectRole(clientId: string, projectKey: string, role: string): Promise<number> {
  const col = await getUsersCollection();
  return col.countDocuments({ projects: { $elemMatch: { clientId, projectKey, role } } });
}

export async function countUsersAssignedRole(clientId: string, projectKey: string, role: string): Promise<number> {
  return countUsersByProjectRole(clientId, projectKey, role);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Creates a brand-new user with one or more project memberships, all scoped to the given client. */
export async function createUser(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  clientId: string;
  projects: { projectKey: string; role: string }[];
  grantedBy: string;
}): Promise<CsaUser> {
  const col = await getUsersCollection();
  const email = data.email.toLowerCase().trim();

  const existing = await col.findOne({ email });
  if (existing) {
    throw new Error(`A user with email '${email}' already exists`);
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const memberships: CsaUserProject[] = data.projects.map((p) => ({
    projectKey: p.projectKey.trim(),
    role: p.role.trim(),
    clientId: data.clientId,
  }));

  const primary = memberships[0];

  const doc: CsaUser = {
    _id: new ObjectId(),
    email,
    passwordHash,
    firstName: data.firstName?.trim() || undefined,
    lastName: data.lastName?.trim() || undefined,
    role: primary?.role ?? "admin",
    projectKey: primary?.projectKey ?? "",
    defaultProjectKey: primary?.projectKey,
    projects: memberships,
    active: true,
    grantedBy: data.grantedBy,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc as never);
  return doc;
}

/**
 * Adds project memberships (scoped to clientId) to an existing user found
 * by email. Dedupes against memberships that already exist for this
 * client+projectKey.
 */
export async function assignUserToClient(data: {
  email: string;
  clientId: string;
  projects: { projectKey: string; role: string }[];
  grantedBy: string;
}): Promise<{ user: CsaUser; assignmentsAdded: CsaUserProject[] } | null> {
  const col = await getUsersCollection();
  const email = data.email.toLowerCase().trim();
  const existing = await col.findOne({ email });
  if (!existing) return null;

  const existingProjects = (existing.projects ?? []) as CsaUserProject[];
  const newAssignments: CsaUserProject[] = data.projects.map((p) => ({
    projectKey: p.projectKey.trim(),
    role: p.role.trim(),
    clientId: data.clientId,
  }));

  const assignmentsToAdd = newAssignments.filter(
    (a) => !existingProjects.some((p) => projectKeysEqual(p.projectKey, a.projectKey) && p.clientId === data.clientId)
  );

  if (assignmentsToAdd.length === 0) {
    throw new Error(`User ${email} is already assigned to the selected project(s) in this client`);
  }

  await col.updateOne(
    { email },
    {
      $push: { projects: { $each: assignmentsToAdd } } as never,
      $set: { updatedAt: new Date(), grantedBy: data.grantedBy },
    }
  );

  const updated = (await col.findOne({ email })) as CsaUser;
  return { user: updated, assignmentsAdded: assignmentsToAdd };
}

/**
 * Replaces this client's slice of a user's project memberships (other
 * clients' memberships are untouched) and optionally updates profile
 * fields / password. Matches the reference app's PUT semantics exactly.
 */
export async function updateClientUser(data: {
  email: string;
  clientId: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  projects?: { projectKey: string; role: string }[];
  grantedBy: string;
}): Promise<CsaUser | null> {
  const col = await getUsersCollection();
  const email = data.email.toLowerCase().trim();
  const existing = await col.findOne({ email });
  if (!existing) return null;

  const set: Record<string, unknown> = { updatedAt: new Date(), grantedBy: data.grantedBy };
  if (data.firstName !== undefined) set.firstName = data.firstName.trim();
  if (data.lastName !== undefined) set.lastName = data.lastName.trim();

  if (data.password && data.password.trim()) {
    set.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  }

  if (data.projects !== undefined) {
    const otherClientsProjects = ((existing.projects ?? []) as CsaUserProject[]).filter(
      (p) => p.clientId !== data.clientId
    );
    const thisClientProjects: CsaUserProject[] = data.projects.map((p) => ({
      projectKey: p.projectKey.trim(),
      role: p.role.trim(),
      clientId: data.clientId,
    }));
    const combined = [...otherClientsProjects, ...thisClientProjects];
    set.projects = combined;
    if (combined.length > 0) {
      set.role = combined[0].role;
      set.projectKey = combined[0].projectKey;
    }
  }

  await col.updateOne({ email }, { $set: set });
  return (await col.findOne({ email })) as CsaUser;
}

/** Removes one project membership (this client + projectKey) from a user. */
export async function removeUserFromProject(email: string, clientId: string, projectKey: string): Promise<boolean> {
  const col = await getUsersCollection();
  const emailNorm = email.toLowerCase().trim();
  const result = await col.updateOne(
    { email: emailNorm, "projects.projectKey": projectKey, "projects.clientId": clientId },
    { $pull: { projects: { projectKey, clientId } } as never, $set: { updatedAt: new Date() } }
  );
  return result.matchedCount > 0;
}

/** Removes every project membership for this client from a user (never deletes the account). */
export async function removeUserFromClient(email: string, clientId: string): Promise<boolean> {
  const col = await getUsersCollection();
  const emailNorm = email.toLowerCase().trim();
  const result = await col.updateOne(
    { email: emailNorm, "projects.clientId": clientId },
    { $pull: { projects: { clientId } } as never, $set: { updatedAt: new Date() } }
  );
  return result.matchedCount > 0;
}

/** Deactivates every membership-holding user for a client (used when a client is deleted) — never deletes accounts. */
export async function deactivateUsersByClient(clientId: string): Promise<number> {
  const col = await getUsersCollection();
  const result = await col.updateMany(
    { $or: [{ "projects.clientId": clientId }, { clientId }] },
    { $set: { active: false, updatedAt: new Date() } }
  );
  return result.modifiedCount;
}

export async function ensureUsersIndex(): Promise<void> {
  const col = await getUsersCollection();
  await col.createIndex({ email: 1 }, { unique: true });
}
