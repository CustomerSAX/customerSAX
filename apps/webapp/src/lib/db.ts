/**
 * MongoDB collection getters for the superadmin feature, built on the
 * shared @csa/mongodb package (same connection-caching client apps/auth
 * uses) rather than a webapp-local client. Collection/DB names follow
 * apps/auth/.env.example's naming convention since csa_users is the exact
 * collection the auth service reads at login — this module writes
 * AuthUser-shaped documents into that same collection, it does not own a
 * separate copy of it.
 */

import { getMongoCollection } from '@csa/mongodb';
import type { Document } from '@csa/mongodb';

function adminDbName(): string {
  return process.env.MONGO_ADMIN_DB?.trim() || 'csa-admin';
}

function agentsDbName(): string {
  return process.env.MONGO_AGENTS_DB?.trim() || 'csa-agents';
}

export async function getClientsCollection<T extends Document = Document>() {
  const collectionName = process.env.MONGO_ADMIN_COLLECTION?.trim() || 'csa_clients';
  return getMongoCollection<T>(collectionName, { dbName: adminDbName() });
}

export async function getProjectsCollection<T extends Document = Document>() {
  const collectionName = process.env.MONGO_PROJECTS_COLLECTION?.trim() || 'csa_projects';
  return getMongoCollection<T>(collectionName, { dbName: adminDbName() });
}

export async function getSmtpProfilesCollection<T extends Document = Document>() {
  const collectionName = process.env.MONGO_SMTP_PROFILES_COLLECTION?.trim() || 'csa_smtp_profiles';
  return getMongoCollection<T>(collectionName, { dbName: adminDbName() });
}

/** The exact collection apps/auth's login/session flow reads — see apps/auth/src/db/mongodb.ts. */
export async function getUsersCollection<T extends Document = Document>() {
  const collectionName = process.env.MONGO_USERS_COLLECTION?.trim() || 'csa_users';
  return getMongoCollection<T>(collectionName, { dbName: agentsDbName() });
}
