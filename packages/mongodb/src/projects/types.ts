import type { ObjectId } from "@csa/mongodb";

export type CommercePlatform = "commercetools" | "shopify" | "bigcommerce";

export interface StoredCtCredentials {
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecretEncrypted: string;
  scopes?: string;
}

export interface StoredShopifyCredentials {
  storeDomain: string;
  adminAccessTokenEncrypted: string;
  apiVersion: string;
}

export interface StoredBigCommerceCredentials {
  storeHash: string;
  clientId: string;
  accessTokenEncrypted: string;
}

export interface ProjectCredentials {
  commercetools?: StoredCtCredentials;
  shopify?: StoredShopifyCredentials;
  bigcommerce?: StoredBigCommerceCredentials;
}

export interface CsaProject {
  _id: ObjectId;
  clientId: string;
  platform?: CommercePlatform;
  credentials?: ProjectCredentials;
  projectKey: string;
  displayName: string;
  ctApiUrl: string;
  ctAuthUrl: string;
  ctClientId: string;
  ctClientSecretEncrypted: string;
  scopes?: string;
  smtpProfileId?: string;
  standaloneB2cEnabled?: boolean;
  standaloneB2bEnabled?: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
