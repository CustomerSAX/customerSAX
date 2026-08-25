/**
 * Named collection accessors for the CSA admin/agents databases.
 *
 * Each getter is the single source of truth for one collection's location: the
 * collection name and database are resolved from env at call time (falling back
 * to the documented defaults) so deployments can override placement without
 * code changes. Domain repositories consume these getters — and never hardcode
 * a collection name — so a collection can be renamed in exactly one place.
 *
 * Databases:
 *  - admin  (`MONGO_ADMIN_DB`,  default `csa-admin`)  — clients, projects,
 *    smtp profiles, roles, ai settings, audit log.
 *  - agents (`MONGO_AGENTS_DB`, default `csa-agents`) — users (the exact
 *    collection `apps/auth` reads at login).
 */

import { env, getMongoCollection } from "../connection.js";

function adminDbName() {
  return env("MONGO_ADMIN_DB") || "csa-admin";
}

function agentsDbName() {
  return env("MONGO_AGENTS_DB") || "csa-agents";
}

export async function getClientsCollection() {
  const collectionName = env("MONGO_ADMIN_COLLECTION") || "clients";
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

export async function getRolesCollection() {
  return getMongoCollection(env("MONGO_ROLES_COLLECTION") || "csa_roles", { dbName: adminDbName() });
}

export async function getAiSettingsCollection() {
  return getMongoCollection(env("MONGO_AI_SETTINGS_COLLECTION") || "csa_ai_settings", { dbName: adminDbName() });
}

export async function getAuditCollection() {
  return getMongoCollection(env("MONGO_AUDIT_COLLECTION") || "csa_audit_log", { dbName: adminDbName() });
}

/** The exact collection apps/auth's login/session flow reads. */
export async function getUsersCollection() {
  const collectionName = env("MONGO_USERS_COLLECTION") || "csa_users";
  return getMongoCollection(collectionName, { dbName: agentsDbName() });
}
