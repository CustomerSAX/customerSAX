import { INITIAL_PROJECT } from "./constants";
import type {
  AiSettingsDraft,
  CommercePlatform,
  OnboardingState,
  ProjectDraft,
  SearchConfigDraft,
  ShellMode,
  SmtpProfileDraft,
  SsoConfigDraft,
  TeamMemberDraft,
  TicketingConfigDraft,
  TicketingProviderOption,
  UiThemeOption
} from "./types";
import { getAlgoliaConfigFromEnv } from "@csa/search";

export interface MappedClientResult {
  state: OnboardingState;
  originalProjectIds: string[];
  originalSmtpProfileId?: string;
}

export function mapClientToOnboardingState(
  clientData: any,
  ticketingData?: any,
  organizationId?: string
): MappedClientResult {
  const client = clientData?.adminClient;
  const projects = clientData?.adminProjectsByClient || [];
  const users = clientData?.adminUsersByClient || [];
  const smtpProfiles = clientData?.adminSmtpProfilesByClient || [];
  const aiData = clientData?.adminAiSettings;

  const originalProjectIds = projects.map((p: { id: string }) => p.id);
  const defaultSmtp = smtpProfiles.find((p: { isDefault: boolean }) => p.isDefault) || smtpProfiles[0];
  const originalSmtpProfileId = defaultSmtp?.id;

  // Map projects
  const mappedProjects: ProjectDraft[] =
    projects.length > 0
      ? projects.map((p: any) => ({
          id: p.id,
          projectKey: p.projectKey,
          displayName: p.displayName || p.projectKey,
          platform: (p.platform as CommercePlatform) || "commercetools",
          shellMode: (p.standaloneB2bEnabled ? "b2b" : "b2c") as ShellMode,
          ctApiUrl: p.ctApiUrl || "https://api.us-central1.gcp.commercetools.com",
          ctAuthUrl: p.ctAuthUrl || "https://auth.us-central1.gcp.commercetools.com",
          ctClientId: p.ctClientId || "",
          ctClientSecret: "",
          ctClientSecretMasked: p.ctClientSecretMasked || (p.ctClientId ? "••••••••••••" : undefined),
          isExisting: true,
          scopes: p.scopes || "",
          shopifyStoreDomain: p.shopifyStoreDomain || "",
          shopifyAdminAccessToken: "",
          shopifyApiVersion: p.shopifyApiVersion || "2024-01",
          bigcommerceStoreHash: p.bigcommerceStoreHash || "",
          bigcommerceClientId: p.bigcommerceClientId || "",
          bigcommerceAccessToken: "",
          testedOk: true,
          testMessage: "Existing connected project"
        }))
      : [{ ...INITIAL_PROJECT }];

  // Map search config
  let searchConfig: SearchConfigDraft = { provider: "native" };
  if (typeof window !== "undefined" && organizationId) {
    try {
      const stored = localStorage.getItem(`csa_org_search_${organizationId}`);
      if (stored) searchConfig = JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  if (!searchConfig.appId) {
    const env = getAlgoliaConfigFromEnv();
    if (env) {
      searchConfig = {
        provider: "algolia",
        appId: env.appId,
        searchApiKey: env.searchApiKey,
        indexName: env.indexName
      };
    }
  }

  // Map ticketing
  let ticketingConfig: TicketingConfigDraft = { provider: "internal" };
  const tData = ticketingData?.adminProjectTicketing;
  if (tData && tData.provider && tData.provider !== "internal") {
    ticketingConfig = {
      provider: tData.provider as TicketingProviderOption,
      subdomain: tData.subdomain || "",
      clientId: tData.clientId || "",
      freshdeskDomain: tData.freshdeskDomain || "",
      testedOk: true
    };
  } else if (projects[0]?.ticketingProvider && projects[0].ticketingProvider !== "internal") {
    ticketingConfig = {
      provider: projects[0].ticketingProvider as TicketingProviderOption
    };
  }

  // Map AI settings
  const aiSettings: AiSettingsDraft = {
    enabled: aiData?.enabled ?? false,
    provider: (aiData?.provider as "openai" | "anthropic") || "openai",
    displayName: aiData?.displayName || "CSA Assistant",
    model: aiData?.model || "gpt-4o-mini",
    baseUrl: aiData?.baseUrl || undefined,
    apiKey: ""
  };

  // Map SMTP profile
  const smtpProfile: SmtpProfileDraft = defaultSmtp
    ? {
        enabled: true,
        name: defaultSmtp.name || "Default SMTP",
        smtpHost: defaultSmtp.smtpHost || "",
        smtpPort: defaultSmtp.smtpPort || 587,
        smtpSecure: defaultSmtp.smtpSecure ?? true,
        smtpUser: defaultSmtp.smtpUser || "",
        smtpPassword: "",
        emailFrom: defaultSmtp.emailFrom || ""
      }
    : {
        enabled: false,
        name: "Primary SMTP",
        smtpHost: "",
        smtpPort: 587,
        smtpSecure: true,
        emailFrom: ""
      };

  // Map SSO config
  const sso = client?.ssoConfig;
  const ssoConfig: SsoConfigDraft =
    sso && sso.provider && sso.provider !== "none"
      ? {
          provider: sso.provider as "none" | "oidc" | "saml",
          issuer: sso.issuer || "",
          clientId: sso.clientId || "",
          providerDisplayName: sso.providerDisplayName || "",
          entryPointUrl: sso.entryPointUrl || ""
        }
      : {
          provider: "none"
        };

  // Map team members
  const teamMembers: TeamMemberDraft[] = users.map((u: any) => ({
    id: u.id,
    mode: "assign",
    email: u.email,
    firstName: u.firstName || undefined,
    lastName: u.lastName || undefined,
    role: (u.role as "admin" | "member" | "customer_service_agent") || "admin",
    projectKeys: u.clientProjects?.map((cp: any) => cp.projectKey) || [],
    isExisting: true
  }));

  const state: OnboardingState = {
    name: client?.name || "",
    slug: client?.slug || "",
    contactEmail: client?.contactEmail || "",
    uiTheme: (client?.uiTheme as UiThemeOption) || "csa-custom",
    projects: mappedProjects,
    search: searchConfig,
    ticketing: ticketingConfig,
    aiSettings,
    smtpProfile,
    ssoConfig,
    teamMembers,
    draftUser: null
  };

  return {
    state,
    originalProjectIds,
    originalSmtpProfileId
  };
}
