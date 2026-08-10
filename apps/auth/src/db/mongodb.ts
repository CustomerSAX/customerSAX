import { env, getMongoCollection, type Collection } from "@csa/mongodb";
import type { AuthUser, SessionRecord } from "../users/types.js";

export async function getUsersCollection(): Promise<Collection<AuthUser>> {
  const dbName = env("MONGO_AGENTS_DB") || "csa-agents";
  const collectionName = env("MONGO_USERS_COLLECTION") || "csa_users";

  return getMongoCollection<AuthUser>(collectionName, { dbName });
}

export async function getSessionsCollection(): Promise<Collection<SessionRecord>> {
  const dbName = env("MONGO_AGENTS_DB") || "csa-agents";
  const collectionName = env("MONGO_SESSIONS_COLLECTION") || "csa_sessions";

  return getMongoCollection<SessionRecord>(collectionName, { dbName });
}
