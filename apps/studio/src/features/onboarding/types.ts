export type UiThemeOption = "csa-custom" | "mantine" | "mui";

export type CommercePlatform = "commercetools" | "shopify" | "bigcommerce";

export type ShellMode = "b2c" | "b2b";

export interface ProjectDraft {
  id: string;
  projectKey: string;
  displayName: string;
  platform: CommercePlatform;
  shellMode: ShellMode;
  // commercetools
  ctApiUrl?: string;
  ctAuthUrl?: string;
  ctClientId?: string;
  ctClientSecret?: string;
  scopes?: string;
  // shopify
  shopifyStoreDomain?: string;
  shopifyAdminAccessToken?: string;
  shopifyApiVersion?: string;
  // bigcommerce
  bigcommerceStoreHash?: string;
  bigcommerceClientId?: string;
  bigcommerceAccessToken?: string;
  // connection test state
  testedOk?: boolean;
  testMessage?: string;
}

export type SearchProviderOption = "native" | "algolia";

export interface SearchConfigDraft {
  provider: SearchProviderOption;
  appId?: string;
  searchApiKey?: string;
  indexName?: string;
  testedOk?: boolean;
  testMessage?: string;
}

export type TicketingProviderOption = "internal" | "zendesk" | "freshdesk";

export interface TicketingConfigDraft {
  provider: TicketingProviderOption;
  subdomain?: string;
  clientId?: string;
  clientSecret?: string;
  freshdeskDomain?: string;
  freshdeskApiKey?: string;
  testedOk?: boolean;
  testMessage?: string;
}

export interface AiSettingsDraft {
  enabled: boolean;
  provider: "openai" | "anthropic";
  displayName: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface SmtpProfileDraft {
  enabled: boolean;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  emailFrom: string;
}

export interface SsoConfigDraft {
  provider: "none" | "oidc" | "saml";
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  providerDisplayName?: string;
  entryPointUrl?: string;
  idpCertPem?: string;
}

export interface TeamMemberDraft {
  id: string;
  mode: "create" | "assign";
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  role: "admin" | "member" | "customer_service_agent";
  projectKeys: string[];
}

export interface OnboardingState {
  // Step 1: Org Basics
  name: string;
  slug: string;
  contactEmail: string;

  // Step 2: Appearance
  uiTheme: UiThemeOption;

  // Step 3: Projects
  projects: ProjectDraft[];

  // Step 4: Search
  search: SearchConfigDraft;

  // Step 5: Ticketing
  ticketing: TicketingConfigDraft;

  // Step 6: Additional Integrations
  aiSettings: AiSettingsDraft;
  smtpProfile: SmtpProfileDraft;
  ssoConfig: SsoConfigDraft;

  // Step 7: Team
  teamMembers: TeamMemberDraft[];
  draftUser?: Partial<TeamMemberDraft> | null;
}

export type StepId = 1 | 2 | 3 | 4 | 5 | 6;

export interface StepMetadata {
  id: StepId;
  title: string;
  navLabel: string;
  description: string;
  icon: string;
  required: boolean;
}
