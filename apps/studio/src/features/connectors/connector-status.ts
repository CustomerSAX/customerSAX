import type { ConnectorCategoryKey } from "../onboarding/connectors.config";
import type { OnboardingState } from "../onboarding/types";

// Saved provider selection determines routing. Secrets are deliberately omitted
// from admin responses and must not be used to infer whether a provider is active.
export function activeConnectorId(category: ConnectorCategoryKey, state: OnboardingState): string {
  switch (category) {
    case "product-search": return state.search?.provider || "native";
    case "ticketing": return state.ticketing?.provider || "internal";
    case "payments": return "native-checkout";
    case "ai": return state.aiSettings?.enabled ? state.aiSettings.provider : "native-ai";
    case "communication": return state.smtpProfile?.enabled ? "smtp" : "native-smtp";
    case "sso": return state.ssoConfig?.provider && state.ssoConfig.provider !== "none" ? state.ssoConfig.provider : "native-auth";
    case "crm": return state.crm?.provider && state.crm.provider !== "none" ? state.crm.provider : "native-crm";
  }
}
