export type SsoConfig = {
  provider: "none" | "oidc" | "saml";
  issuer?: string | null;
  clientId?: string | null;
  providerDisplayName?: string | null;
  extraScopes?: string | null;
  authorizeConnection?: string | null;
  oidcClientSecretSet?: boolean | null;
  entryPointUrl?: string | null;
  idpCertSet?: boolean | null;
};

export type ClientDetail = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: "active" | "blocked";
  createdAt?: string | null;
  createdBy?: string | null;
  ssoConfig: SsoConfig;
};

export type Platform = "commercetools" | "shopify" | "bigcommerce";
export type ShellMode = "b2c" | "b2b";

export interface ProjectRow {
  id: string;
  clientId: string;
  platform: Platform;
  projectKey: string;
  displayName: string;
  ctApiUrl: string;
  ctAuthUrl: string;
  ctClientId: string;
  ctClientSecretMasked: string;
  scopes?: string | null;
  smtpProfileId?: string | null;
  standaloneB2cEnabled?: boolean | null;
  standaloneB2bEnabled?: boolean | null;
  shopifyStoreDomain?: string | null;
  shopifyApiVersion?: string | null;
  bigcommerceStoreHash?: string | null;
  bigcommerceClientId?: string | null;
  createdAt?: string | null;
}

export interface UserProjectEntry {
  projectKey: string;
  role: string;
}

export interface UserRow {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  active: boolean;
  clientProjects: UserProjectEntry[];
}

export interface SmtpProfileRow {
  id: string;
  clientId: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordMasked: string;
  emailFrom: string;
  isDefault: boolean;
}

export type TabKey = "overview" | "projects" | "users" | "email";
