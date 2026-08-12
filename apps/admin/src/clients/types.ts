import type { ObjectId } from "@csa/mongodb";

export type ClientStatus = "active" | "blocked";

export type ClientSsoProviderKind = "none" | "oidc" | "saml";

export interface ClientSsoOidcStored {
  provider: "oidc";
  issuer: string;
  clientId: string;
  clientSecret: string;
  providerDisplayName?: string;
  extraScopes?: string;
  authorizeConnection?: string;
}

export interface ClientSsoSamlStored {
  provider: "saml";
  entryPointUrl: string;
  issuer: string;
  idpCertPem: string;
}

export type ClientSsoConfigStored = { provider: "none" } | ClientSsoOidcStored | ClientSsoSamlStored;

export interface CsaClient {
  _id: ObjectId;
  name: string;
  slug: string;
  contactEmail: string;
  status: ClientStatus;
  ssoConfig?: ClientSsoConfigStored;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
