import crypto from "node:crypto";
import { env, getMongoCollection, type Document } from "@csa/mongodb";

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

function decryptProjectSecret(ciphertext: string, projectKey: string) {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Stored project secret has an invalid encrypted format");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(parts[0], "hex"));
    decipher.setAuthTag(Buffer.from(parts[1], "hex"));
    return decipher.update(Buffer.from(parts[2], "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    throw new Error(`Cannot decrypt credentials for '${projectKey}'. Configure the commerce service with the same SUPERADMIN_ENCRYPTION_KEY used by the Admin service.`);
  }
}

function encryptionKey() {
  const key = process.env.SUPERADMIN_ENCRYPTION_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("SUPERADMIN_ENCRYPTION_KEY is required to use stored project credentials");
    return Buffer.alloc(32, "dev-default-not-for-production-!");
  }
  if (/^[0-9a-fA-F]{64}$/.test(key)) return Buffer.from(key, "hex");
  const result = Buffer.alloc(32);
  Buffer.from(key, "utf8").copy(result, 0, 0, 32);
  return result;
}
