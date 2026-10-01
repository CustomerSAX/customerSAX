import type { OnboardingState } from "./types";

export type ConnectorCategoryKey =
  | "product-search"
  | "ticketing"
  | "payments"
  | "ai"
  | "communication"
  | "sso"
  | "crm";

export interface ConnectorCategoryConfig {
  id: ConnectorCategoryKey;
  name: string;
  badge?: string;
  description: string;
  icon: string;
  nativeIntegration: {
    id: string;
    name: string;
    description: string;
    icon: string;
    isActive: (state: OnboardingState) => boolean;
  };
  connectors: ConnectorConfig[];
}

export interface ConnectorConfig {
  id: string;
  name: string;
  category: ConnectorCategoryKey;
  badge?: string;
  badgeTone?: "primary" | "success" | "neutral" | "warning";
  description: string;
  icon?: string;
  isAvailable: boolean; // false for "coming_soon"
  comingSoonNote?: string;
  isConfigured?: (state: OnboardingState) => boolean;
  getConfigSummary?: (state: OnboardingState) => string | null;
}

export const CONNECTOR_CATEGORIES: ConnectorCategoryConfig[] = [
  {
    id: "product-search",
    name: "Product Search",
    badge: "Catalog Indexing",
    description: "Configure product catalog indexing and instant search capabilities for support reps.",
    icon: "search",
    nativeIntegration: {
      id: "native",
      name: "Native Commerce Search",
      description:
        "Queries connected commerce catalog APIs (commercetools / Shopify / BigCommerce) directly. Works out of the box with zero external configuration.",
      icon: "layers",
      isActive: (state) => !state.search?.provider || state.search.provider === "native"
    },
    connectors: [
      {
        id: "algolia",
        name: "Algolia InstantSearch",
        category: "product-search",
        badge: "High Performance",
        badgeTone: "primary",
        description:
          "Blazing fast catalog search with multi-faceted filtering, typo tolerance, dynamic numeric ranges, and index analytics.",
        isAvailable: true,
        isConfigured: (state) =>
          state.search?.provider === "algolia" &&
          Boolean(state.search?.appId && state.search?.searchApiKey && state.search?.indexName),
        getConfigSummary: (state) =>
          state.search?.indexName ? `Index: ${state.search.indexName}` : "Configured"
      },
      {
        id: "elasticsearch",
        name: "Elasticsearch",
        category: "product-search",
        badge: "Coming Soon",
        badgeTone: "neutral",
        description:
          "Open-source distributed search and analytics engine for high-scale catalog indexing.",
        isAvailable: false,
        comingSoonNote: "Connector on near-term roadmap"
      }
    ]
  },
  {
    id: "ticketing",
    name: "Customer Support & Ticketing",
    badge: "Helpdesk & Cases",
    description: "Configure case intake, ticket synchronization, and customer communication channels.",
    icon: "life-buoy",
    nativeIntegration: {
      id: "internal",
      name: "CSA Native Ticketing",
      description:
        "Built-in customer service desk with threaded worklogs, status tracking, SLAs, and direct order linking. Active by default with zero setup.",
      icon: "life-buoy",
      isActive: (state) => !state.ticketing?.provider || state.ticketing.provider === "internal"
    },
    connectors: [
      {
        id: "zendesk",
        name: "Zendesk Support",
        category: "ticketing",
        badge: "OAuth 2.0",
        badgeTone: "primary",
        description:
          "Bidirectional ticket synchronization using Zendesk confidential OAuth client with read and tickets:write scopes.",
        isAvailable: true,
        isConfigured: (state) =>
          state.ticketing?.provider === "zendesk" &&
          Boolean(state.ticketing?.subdomain && state.ticketing?.clientId && state.ticketing?.clientSecret),
        getConfigSummary: (state) =>
          state.ticketing?.subdomain ? `${state.ticketing.subdomain}.zendesk.com` : "Configured"
      },
      {
        id: "freshdesk",
        name: "Freshdesk",
        category: "ticketing",
        badge: "REST API v2",
        badgeTone: "primary",
        description:
          "Connect to Freshdesk support desk using domain and API key with automated field and agent resolution.",
        isAvailable: true,
        isConfigured: (state) =>
          state.ticketing?.provider === "freshdesk" &&
          Boolean(state.ticketing?.freshdeskDomain && state.ticketing?.freshdeskApiKey),
        getConfigSummary: (state) =>
          state.ticketing?.freshdeskDomain ? `${state.ticketing.freshdeskDomain}.freshdesk.com` : "Configured"
      },
      {
        id: "salesforce-service",
        name: "Salesforce Service Cloud",
        category: "ticketing",
        badge: "Coming Soon",
        badgeTone: "neutral",
        description:
          "Enterprise customer service cases, live chat sessions, and omni-channel agent routing.",
        isAvailable: false,
        comingSoonNote: "Connector on near-term roadmap"
      }
    ]
  },
  {
    id: "payments",
    name: "Payments & Checkout",
    badge: "Billing & Gateways",
    description: "Configure payment gateways, transaction settlement, and automated refund workflows.",
    icon: "credit-card",
    nativeIntegration: {
      id: "native-checkout",
      name: "Native Commerce Checkout",
      description:
        "Processes customer transactions, captures, and refund requests through the connected primary commerce store gateways.",
      icon: "shopping-cart",
      isActive: () => true
    },
    connectors: [
      {
        id: "stripe",
        name: "Stripe Payments",
        category: "payments",
        badge: "Coming Soon",
        badgeTone: "neutral",
        description:
          "Global online payment processing supporting cards, Apple Pay, Google Pay, and localized bank payment methods.",
        isAvailable: false,
        comingSoonNote: "Connector on near-term roadmap"
      },
      {
        id: "adyen",
        name: "Adyen",
        category: "payments",
        badge: "Coming Soon",
        badgeTone: "neutral",
        description:
          "Unified omnichannel commerce payments with automated multi-currency settlement and built-in fraud prevention.",
        isAvailable: false,
        comingSoonNote: "Connector on near-term roadmap"
      }
    ]
  },
  {
    id: "ai",
    name: "AI & Conversational Intelligence",
    badge: "LLM Copilot",
    description: "Power support reps with AI-assisted order lookups, returns, draft responses, and tool execution.",
    icon: "bot",
    nativeIntegration: {
      id: "native-ai",
      name: "Standard Assistant Engine",
      description:
        "Rule-based deterministic support helpers and template lookups without external LLM processing.",
      icon: "cpu",
      isActive: (state) => !state.aiSettings?.enabled
    },
    connectors: [
      {
        id: "openai",
        name: "OpenAI",
        category: "ai",
        badge: "GPT-4o / GPT-4o-mini",
        badgeTone: "primary",
        description:
          "Enterprise LLM endpoints via OpenAI platform with high throughput and function calling.",
        isAvailable: true,
        isConfigured: (state) =>
          Boolean(state.aiSettings?.enabled && state.aiSettings?.provider === "openai" && state.aiSettings?.apiKey),
        getConfigSummary: (state) =>
          state.aiSettings?.model ? `Model: ${state.aiSettings.model}` : "Configured"
      },
      {
        id: "anthropic",
        name: "Anthropic",
        category: "ai",
        badge: "Claude 3.5 Sonnet",
        badgeTone: "primary",
        description:
          "Advanced reasoning and contextual analysis powered by Anthropic Claude 3.5 models.",
        isAvailable: true,
        isConfigured: (state) =>
          Boolean(state.aiSettings?.enabled && state.aiSettings?.provider === "anthropic" && state.aiSettings?.apiKey),
        getConfigSummary: (state) =>
          state.aiSettings?.model ? `Model: ${state.aiSettings.model}` : "Configured"
      }
    ]
  },
  {
    id: "communication",
    name: "Email & Communication (SMTP)",
    badge: "Transactional Relay",
    description: "Connect custom outbound SMTP relays for customer email replies and automated notification alerts.",
    icon: "mail",
    nativeIntegration: {
      id: "native-smtp",
      name: "CSA System Mailer",
      description:
        "System default notification service for administrative notifications and platform onboarding links.",
      icon: "mail",
      isActive: (state) => !state.smtpProfile?.enabled
    },
    connectors: [
      {
        id: "smtp",
        name: "Custom Outbound SMTP",
        category: "communication",
        badge: "Custom Relay",
        badgeTone: "primary",
        description:
          "Route transactional customer emails and ticket notifications through SendGrid, Postmark, AWS SES, or custom SMTP.",
        isAvailable: true,
        icon: "send",
        isConfigured: (state) =>
          Boolean(state.smtpProfile?.enabled && state.smtpProfile?.smtpHost && state.smtpProfile?.emailFrom),
        getConfigSummary: (state) =>
          state.smtpProfile?.smtpHost ? `${state.smtpProfile.smtpHost}:${state.smtpProfile.smtpPort || 587}` : "Configured"
      }
    ]
  },
  {
    id: "sso",
    name: "Single Sign-On (SSO / Federation)",
    badge: "Identity Provider",
    description: "Integrate Okta, Microsoft Entra ID / Azure AD, Google Workspace, or corporate SAML IdP.",
    icon: "key",
    nativeIntegration: {
      id: "native-auth",
      name: "Direct Platform Authentication",
      description:
        "Standard user password authentication with secure hashing, session management, and role-based permissions.",
      icon: "lock",
      isActive: (state) => !state.ssoConfig?.provider || state.ssoConfig.provider === "none"
    },
    connectors: [
      {
        id: "oidc",
        name: "OpenID Connect (OIDC)",
        category: "sso",
        badge: "Modern IdP",
        badgeTone: "primary",
        description:
          "Enterprise identity federation with Okta, Azure AD, Auth0, or Ping Identity via OpenID Connect.",
        isAvailable: true,
        icon: "key",
        isConfigured: (state) =>
          state.ssoConfig?.provider === "oidc" &&
          Boolean(state.ssoConfig?.issuer && state.ssoConfig?.clientId),
        getConfigSummary: (state) =>
          state.ssoConfig?.issuer ? `Issuer: ${state.ssoConfig.issuer.replace(/^https?:\/\//, "").slice(0, 20)}...` : "Configured"
      },
      {
        id: "saml",
        name: "SAML 2.0 Identity Provider",
        category: "sso",
        badge: "Enterprise SAML",
        badgeTone: "primary",
        description:
          "Single Sign-On via SAML 2.0 XML metadata or IdP entry point for enterprise Active Directory.",
        isAvailable: true,
        icon: "shield",
        isConfigured: (state) =>
          state.ssoConfig?.provider === "saml" && Boolean(state.ssoConfig?.entryPointUrl),
        getConfigSummary: (state) =>
          state.ssoConfig?.entryPointUrl ? "SAML Configured" : "Configured"
      }
    ]
  },
  {
    id: "crm",
    name: "CRM & Customer Data",
    badge: "Customer 360",
    description: "Connect external customer relation platforms, sales history, and marketing timelines.",
    icon: "users",
    nativeIntegration: {
      id: "native-crm",
      name: "Native Customer Directory",
      description:
        "Synchronizes customer profiles, orders, and addresses directly from your connected commerce platform.",
      icon: "database",
      isActive: () => true
    },
    connectors: [
      {
        id: "salesforce",
        name: "Salesforce CRM",
        category: "crm",
        badge: "Coming Soon",
        badgeTone: "neutral",
        description:
          "Synchronize B2B customer accounts, contacts, opportunities, and custom CRM objects.",
        isAvailable: false,
        comingSoonNote: "Connector on near-term roadmap"
      },
      {
        id: "hubspot",
        name: "HubSpot",
        category: "crm",
        badge: "Coming Soon",
        badgeTone: "neutral",
        description:
          "Connect contact timelines, marketing properties, and customer engagement history.",
        isAvailable: false,
        comingSoonNote: "Connector on near-term roadmap"
      }
    ]
  }
];
