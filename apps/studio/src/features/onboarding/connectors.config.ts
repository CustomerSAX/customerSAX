import type { OnboardingState } from "./types";

export type ConnectorCategoryKey =
  "product-search" | "ticketing" | "payments" | "ai" | "communication" | "sso" | "crm";

export interface NativeConnectorCategoryConfig {
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
}

export const NATIVE_CONNECTOR_CATEGORIES: NativeConnectorCategoryConfig[] = [
  {
    id: "product-search",
    name: "Product Search",
    badge: "Catalog Indexing",
    description:
      "Configure product catalog indexing and instant search capabilities for support reps.",
    icon: "search",
    nativeIntegration: {
      id: "native",
      name: "Native Commerce Search",
      description:
        "Queries connected commerce catalog APIs (commercetools / Shopify / BigCommerce) directly. Works out of the box with zero external configuration.",
      icon: "layers",
      isActive: (state) => !state.search?.provider || state.search.provider === "native"
    }
  },
  {
    id: "ticketing",
    name: "Customer Support & Ticketing",
    badge: "Helpdesk & Cases",
    description:
      "Configure case intake, ticket synchronization, and customer communication channels.",
    icon: "life-buoy",
    nativeIntegration: {
      id: "internal",
      name: "CSA Native Ticketing",
      description:
        "Built-in customer service desk with threaded worklogs, status tracking, SLAs, and direct order linking. Active by default with zero setup.",
      icon: "life-buoy",
      isActive: (state) =>
        !state.ticketing?.provider || state.ticketing.provider === "internal"
    }
  },
  {
    id: "payments",
    name: "Payments & Checkout",
    badge: "Billing & Gateways",
    description:
      "Configure payment gateways, transaction settlement, and automated refund workflows.",
    icon: "credit-card",
    nativeIntegration: {
      id: "native-checkout",
      name: "Native Commerce Checkout",
      description:
        "Processes customer transactions, captures, and refund requests through the connected primary commerce store gateways.",
      icon: "shopping-cart",
      isActive: () => true
    }
  },
  {
    id: "ai",
    name: "AI & Conversational Intelligence",
    badge: "LLM Copilot",
    description:
      "Power support reps with AI-assisted order lookups, returns, draft responses, and tool execution.",
    icon: "bot",
    nativeIntegration: {
      id: "native-ai",
      name: "Standard Assistant Engine",
      description:
        "Rule-based deterministic support helpers and template lookups without external LLM processing.",
      icon: "cpu",
      isActive: (state) => !state.aiSettings?.enabled
    }
  },
  {
    id: "communication",
    name: "Email & Communication (SMTP)",
    badge: "Transactional Relay",
    description:
      "Connect custom outbound SMTP relays for customer email replies and automated notification alerts.",
    icon: "mail",
    nativeIntegration: {
      id: "native-smtp",
      name: "CSA System Mailer",
      description:
        "System default notification service for administrative notifications and platform onboarding links.",
      icon: "mail",
      isActive: (state) => !state.smtpProfile?.enabled
    }
  },
  {
    id: "sso",
    name: "Single Sign-On (SSO / Federation)",
    badge: "Identity Provider",
    description:
      "Integrate Okta, Microsoft Entra ID / Azure AD, Google Workspace, or corporate SAML IdP.",
    icon: "key",
    nativeIntegration: {
      id: "native-auth",
      name: "Direct Platform Authentication",
      description:
        "Standard user password authentication with secure hashing, session management, and role-based permissions.",
      icon: "lock",
      isActive: (state) =>
        !state.ssoConfig?.provider || state.ssoConfig.provider === "none"
    }
  },
  {
    id: "crm",
    name: "CRM & Customer Data",
    badge: "Customer 360",
    description:
      "Connect external customer relation platforms, sales history, and marketing timelines.",
    icon: "users",
    nativeIntegration: {
      id: "native-crm",
      name: "Native Customer Directory",
      description:
        "Synchronizes customer profiles, orders, and addresses directly from your connected commerce platform.",
      icon: "database",
      isActive: (state) => !state.crm?.provider || state.crm.provider === "none"
    }
  }
];
