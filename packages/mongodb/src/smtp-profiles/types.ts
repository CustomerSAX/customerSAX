/**
 * Document type for per-client SMTP profiles (the `csa_smtp_profiles`
 * collection). The SMTP password is persisted only as `smtpPasswordEncrypted`
 * (AES-256-GCM); at most one profile per client is flagged `isDefault`.
 */

import type { ObjectId } from "@csa/mongodb";

export interface CsaSmtpProfile {
  _id: ObjectId;
  clientId: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordEncrypted: string;
  emailFrom: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
