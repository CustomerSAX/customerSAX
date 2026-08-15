/**
 * Loads a per-tenant commercetools project record from the shared Superadmin
 * MongoDB store and decrypts its client secret for use by this subgraph.
 *
 * Secrets are stored encrypted (AES-256-GCM, `iv:authTag:ciphertext` hex) by
 * the Admin service; they are only ever decrypted in memory here, never
 * persisted or logged in plaintext. Decryption REQUIRES the same
 * `SUPERADMIN_ENCRYPTION_KEY` the Admin service used to encrypt them — a
 * mismatch surfaces as a clear, actionable error rather than a silent auth
 * failure downstream. Both the collection and DB names come from env
 * (`MONGO_PROJECTS_COLLECTION`, `MONGO_ADMIN_DB`) with documented defaults.
 *
 * Two record layouts are supported: the current nested
 * `credentials.commercetools.*` shape and a legacy flat `ct*` shape, so older
 * Superadmin documents keep resolving.
 */
import { decrypt, env, getMongoCollection, type Document } from "@csa/mongodb";

type StoredProject = Document & {
  clientId: string;
  platform?: string;
  projectKey: string;
  credentials?: {
    commercetools?: {
      apiUrl?: string;
      authUrl?: string;
      clientId?: string;
      clientSecretEncrypted?: string;
      scopes?: string;
    };
  };
  ctApiUrl?: string;
  ctAuthUrl?: string;
  ctClientId?: string;
  ctClientSecretEncrypted?: string;
  scopes?: string;
};

export async function findStoredCommercetoolsProject(clientId: string, projectKey: string) {
  const collection = await getMongoCollection<StoredProject>(env("MONGO_PROJECTS_COLLECTION") || "csa_projects", {
    dbName: env("MONGO_ADMIN_DB") || "csa-admin"
  });
  const project = await collection.findOne({ clientId, projectKey });
  if (!project) return null;
  if (project.platform && project.platform !== "commercetools") {
    throw new Error(`Selected project '${projectKey}' uses platform '${project.platform}', not commercetools`);
  }
  const credentials = project.credentials?.commercetools;
  const encryptedSecret = credentials?.clientSecretEncrypted || project.ctClientSecretEncrypted;
  if (!encryptedSecret) throw new Error(`Selected project '${projectKey}' has no stored commercetools secret`);
  return {
    apiUrl: credentials?.apiUrl || project.ctApiUrl,
    authUrl: credentials?.authUrl || project.ctAuthUrl,
    clientId: credentials?.clientId || project.ctClientId,
    clientSecret: decryptProjectSecret(encryptedSecret, projectKey),
    scope: credentials?.scopes || project.scopes
  };
}

/**
 * Decrypts a stored `iv:authTag:ciphertext` project secret, delegating the
 * AES-256-GCM work (and `SUPERADMIN_ENCRYPTION_KEY` derivation) to the shared
 * `@csa/mongodb` `decrypt()` — the single source of truth the Admin service
 * also encrypts with, guaranteeing byte-identical crypto across services.
 *
 * The surrounding format check and catch preserve this subgraph's own,
 * more actionable error messages (key-mismatch guidance) over the generic
 * decrypt error.
 */
function decryptProjectSecret(ciphertext: string, projectKey: string) {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Stored project secret has an invalid encrypted format");
  try {
    return decrypt(ciphertext);
  } catch {
    throw new Error(`Cannot decrypt credentials for '${projectKey}'. Configure the commerce service with the same SUPERADMIN_ENCRYPTION_KEY used by the Admin service.`);
  }
}
