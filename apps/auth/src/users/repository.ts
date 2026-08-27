import { getSessionsCollection, getUsersCollection } from "../db/mongodb.js";
import { ObjectId } from "@csa/mongodb";
import type { SessionRecord } from "./types.js";

export async function ensureAuthIndexes() {
  const users = await getUsersCollection();
  const sessions = await getSessionsCollection();

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
}

export async function findUserByEmail(email: string) {
  const users = await getUsersCollection();

  return users.findOne({ email: email.trim().toLowerCase(), active: true });
}

export async function findUserById(id: string) {
  const users = await getUsersCollection();
  const filters: Array<Record<string, unknown>> = [{ id }];

  if (ObjectId.isValid(id)) {
    filters.push({ _id: new ObjectId(id) });
  }

  return users.findOne({ active: true, $or: filters });
}

export async function listActiveUsersByProject(projectKey: string, clientId?: string) {
  const users = await getUsersCollection();
  const projectFilter = clientId
    ? { $elemMatch: { projectKey, clientId } }
    : { $elemMatch: { projectKey } };
  const legacyProjectFilter: Record<string, unknown> = clientId
    ? { projectKey, tenantId: clientId }
    : { projectKey };
  const filter: Record<string, unknown> = {
    active: true,
    $or: [
      { projects: projectFilter },
      legacyProjectFilter
    ]
  };

  return users
    .find(filter)
    .sort({ email: 1 })
    .toArray();
}

export async function latestSessionCreatedAtByUserIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, Date>();

  const sessions = await getSessionsCollection();
  const rows = await sessions
    .aggregate<{ _id: string; lastLoggedInAt: Date }>([
      { $match: { userId: { $in: userIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$userId", lastLoggedInAt: { $first: "$createdAt" } } }
    ])
    .toArray();

  return new Map(rows.map((row) => [row._id, row.lastLoggedInAt]));
}

export async function createSession(record: SessionRecord) {
  const sessions = await getSessionsCollection();
  await sessions.insertOne(record);

  return record;
}

export async function findActiveSessionByTokenHash(tokenHash: string) {
  const sessions = await getSessionsCollection();

  return sessions.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
    revokedAt: { $exists: false }
  });
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  const sessions = await getSessionsCollection();

  await sessions.updateOne(
    { tokenHash, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}

export async function setSessionProject(tokenHash: string, activeProjectKey: string, activeClientId?: string) {
  const sessions = await getSessionsCollection();
  await sessions.updateOne(
    { tokenHash, expiresAt: { $gt: new Date() }, revokedAt: { $exists: false } },
    activeClientId
      ? { $set: { activeProjectKey, activeClientId } }
      : { $set: { activeProjectKey }, $unset: { activeClientId: "" } }
  );
}
