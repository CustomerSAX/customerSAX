/**
 * Seed/Create a superadmin user directly in the MongoDB csa_users collection.
 * Bypasses the running app (and its auth middleware) entirely — connects
 * straight to MONGO_URI, so it works even before webapp or apps/auth have
 * been started once.
 *
 * Writes a document shaped exactly like apps/auth/src/users/types.ts's
 * AuthUser, so the account can log in through the real /login flow
 * immediately — no separate activation step. Superadmins aren't scoped to
 * any one client organisation, so tenantId is set to the 'platform'
 * sentinel value.
 *
 * Run from `apps/webapp` with env loaded:
 *   node --env-file=.env scripts/create-superadmin.mjs <email> <password>
 */

import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const email = (process.argv[2] || 'superadmin@example.com').trim().toLowerCase();
const password = process.argv[3] || 'superadmin123';

const uri = process.env.MONGO_URI?.trim();
const dbName = process.env.MONGO_AGENTS_DB?.trim() || 'csa-agents';
const collName = process.env.MONGO_USERS_COLLECTION?.trim() || 'csa_users';

if (!uri) {
  console.error('[create-superadmin] MONGO_URI is not set in environment/env-file');
  process.exit(1);
}

if (password.length < 8) {
  console.error('[create-superadmin] Password must be at least 8 characters long');
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection(collName);

  const existing = await col.findOne({ email });
  if (existing) {
    if (existing.role === 'superadmin') {
      console.log(`[create-superadmin] Superadmin with email ${email} already exists.`);
    } else {
      console.error(`[create-superadmin] User with email ${email} already exists with role '${existing.role}'.`);
    }
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const _id = new ObjectId();

  // Document shape matches apps/auth's AuthUser type exactly.
  const superadminDoc = {
    _id,
    id: _id.toHexString(),
    active: true,
    email,
    firstName: 'Super',
    lastName: 'Admin',
    name: 'Super Admin',
    passwordHash,
    role: 'superadmin',
    tenantId: 'platform',
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(superadminDoc);
  console.log(`[create-superadmin] Successfully created superadmin user:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);

  try {
    await col.createIndex({ email: 1 }, { unique: true });
    console.log(`[create-superadmin] Ensured unique index on email.`);
  } catch (idxErr) {
    console.warn(`[create-superadmin] Warning when creating index:`, idxErr.message);
  }
} catch (err) {
  console.error('[create-superadmin] Error seeding superadmin:', err);
  process.exit(1);
} finally {
  await client.close();
}
