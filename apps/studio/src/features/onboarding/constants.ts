import type { OnboardingState, ProjectDraft, StepMetadata, UiThemeOption } from "./types";

export const ONBOARDING_DRAFT_STORAGE_KEY = "csa_onboarding_draft_v1";

export const STEPS: StepMetadata[] = [
  {
    id: 1,
    title: "Organization Details",
    navLabel: "Organization",
    description: "Set up the tenant identity, display name, and administrative contact.",
    icon: "building-2",
    required: true
  },
  {
    id: 2,
    title: "Appearance & Design System",
    navLabel: "Appearance",
    description: "Choose the UI library adapter used to render the studio interface for this tenant.",
    icon: "palette",
    required: false
  },
  {
    id: 3,
    title: "Projects & Commerce",
    navLabel: "Projects",
    description: "Connect commerce catalogs and configure regional projects.",
    icon: "briefcase",
    required: true
  },
  {
    id: 4,
    title: "Connectors & Integrations",
    navLabel: "Connectors",
    description: "Manage product search, ticketing, AI, and third-party platform connectors.",
    icon: "cpu",
    required: false
  },
  {
    id: 5,
    title: "Team & Project Access",
    navLabel: "Team & Access",
    description: "Invite initial team members or assign existing platform users to projects.",
    icon: "users",
    required: false
  },
  {
    id: 6,
    title: "Review & Launch",
    navLabel: "Review & Launch",
    description: "Review configured capabilities and provision the organization.",
    icon: "rocket",
    required: true
  }
];

export const INITIAL_PROJECT: ProjectDraft = {
  id: "proj_initial",
  projectKey: "",
  displayName: "",
  platform: "commercetools",
  shellMode: "b2c",
  ctApiUrl: "https://api.us-central1.gcp.commercetools.com",
  ctAuthUrl: "https://auth.us-central1.gcp.commercetools.com",
  ctClientId: "",
  ctClientSecret: "",
  scopes: "",
  shopifyApiVersion: "2024-01"
};

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  name: "",
  slug: "",
  contactEmail: "",
  uiTheme: "csa-custom",
  projects: [{ ...INITIAL_PROJECT }],
  search: {
    provider: "native"
  },
  ticketing: {
    provider: "internal"
  },
  aiSettings: {
    enabled: false,
    provider: "openai",
    displayName: "CSA Assistant",
    model: "gpt-4o-mini"
  },
  smtpProfile: {
    enabled: false,
    name: "Primary SMTP",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: true,
    emailFrom: ""
  },
  ssoConfig: {
    provider: "none"
  },
  teamMembers: [],
  draftUser: null
};

export const UI_THEME_OPTIONS: Array<{
  id: UiThemeOption;
  name: string;
  badge: string;
  description: string;
  tagColor: string;
}> = [
  {
    id: "csa-custom",
    name: "CSA Custom",
    badge: "Default",
    description: "Native Tailwind CSS design system with Meridian tokens. Ultra-fast, clean, and responsive.",
    tagColor: "#3B82F6"
  },
  {
    id: "mantine",
    name: "Mantine UI",
    badge: "v7 Core",
    description: "Component-rich design system powered by Mantine v7. Ideal for data-dense enterprise dashboards.",
    tagColor: "#0D9488"
  },
  {
    id: "mui",
    name: "Material UI",
    badge: "MUI v5",
    description: "Google Material Design with elevated surfaces, ripple effects, and classic form controls.",
    tagColor: "#EA580C"
  }
];

export const COMMERCE_PLATFORMS = [
  {
    id: "commercetools" as const,
    name: "commercetools",
    badge: "Active / Verified",
    description: "Composable MACH commerce with native GraphQL federation, B2B cart structures, and real-time inventory.",
    icon: "boxes"
  },
  {
    id: "shopify" as const,
    name: "Shopify Plus",
    badge: "GraphQL Admin API",
    description: "Connect a Shopify Plus store using Admin GraphQL access tokens for customer, order, and product sync.",
    icon: "shopping-bag"
  },
  {
    id: "bigcommerce" as const,
    name: "BigCommerce",
    badge: "Enterprise API",
    description: "Multi-storefront enterprise commerce connected via store hash, client ID, and REST/GraphQL tokens.",
    icon: "shopping-cart"
  }
];

export const SEARCH_PROVIDERS = [
  {
    id: "native" as const,
    name: "Native Commerce Search",
    badge: "Default / Zero Config",
    description: "Leverages the connected commerce platform's built-in product search. Works out of the box with zero external configuration.",
    icon: "layers"
  },
  {
    id: "algolia" as const,
    name: "Algolia InstantSearch",
    badge: "High Performance",
    description: "Blazing fast catalog search with multi-faceted filtering, typo tolerance, dynamic numeric ranges, and index analytics.",
    icon: "zap"
  }
];

export const TICKETING_PROVIDERS = [
  {
    id: "internal" as const,
    name: "CSA Native Ticketing",
    badge: "Default / Built-in",
    description: "Built-in customer service ticket desk with threaded worklogs, status tracking, SLAs, and direct order linking.",
    icon: "life-buoy"
  },
  {
    id: "zendesk" as const,
    name: "Zendesk Support",
    badge: "OAuth 2.0 Integration",
    description: "Bidirectional ticket synchronization using Zendesk confidential OAuth client with read and tickets:write scopes.",
    icon: "external-link"
  },
  {
    id: "freshdesk" as const,
    name: "Freshdesk",
    badge: "REST API Integration",
    description: "Connect to Freshdesk support desk using domain and API key with automated field and agent resolution.",
    icon: "inbox"
  }
];
