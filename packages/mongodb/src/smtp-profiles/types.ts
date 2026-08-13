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
