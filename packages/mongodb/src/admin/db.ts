import { env, getMongoCollection } from "../connection.js";

function adminDbName() {
  return env("MONGO_ADMIN_DB") || "csa-admin";
}

function agentsDbName() {
  return env("MONGO_AGENTS_DB") || "csa-agents";
}

export async function getClientsCollection() {
  const collectionName = env("MONGO_ADMIN_COLLECTION") || "csa_clients";
  return getMongoCollection(collectionName, { dbName: adminDbName() });
}

export async function getProjectsCollection() {
  const collectionName = env("MONGO_PROJECTS_COLLECTION") || "csa_projects";
  return getMongoCollection(collectionName, { dbName: adminDbName() });
}

export async function getSmtpProfilesCollection() {
  const collectionName = env("MONGO_SMTP_PROFILES_COLLECTION") || "csa_smtp_profiles";
  return getMongoCollection(collectionName, { dbName: adminDbName() });
}

/** The exact collection apps/auth's login/session flow reads. */
export async function getUsersCollection() {
  const collectionName = env("MONGO_USERS_COLLECTION") || "csa_users";
  return getMongoCollection(collectionName, { dbName: agentsDbName() });
}
