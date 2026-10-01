import { describe, expect, it } from "vitest";
import { CONNECTOR_CATEGORIES } from "./connectors.config";
import { INITIAL_ONBOARDING_STATE, STEPS } from "./constants";
import type { OnboardingState } from "./types";

describe("Onboarding 6-Step Journey & Connectors Consolidation", () => {
  it("defines the exact 6-step conceptual journey", () => {
    expect(STEPS).toHaveLength(6);
    expect(STEPS.map((s) => s.navLabel)).toEqual([
      "Organization",
      "Appearance",
      "Projects",
      "Connectors",
      "Team & Access",
      "Review & Launch"
    ]);
  });

  it("configures Product Search, Ticketing, and Payments inside Connectors categories", () => {
    const categoryIds = CONNECTOR_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toContain("product-search");
    expect(categoryIds).toContain("ticketing");
    expect(categoryIds).toContain("payments");
    expect(categoryIds).toContain("ai");
    expect(categoryIds).toContain("communication");
    expect(categoryIds).toContain("sso");
  });

  it("defaults to native integrations with zero configuration required", () => {
    const state: OnboardingState = { ...INITIAL_ONBOARDING_STATE };

    const searchCategory = CONNECTOR_CATEGORIES.find((c) => c.id === "product-search")!;
    expect(searchCategory.nativeIntegration.isActive(state)).toBe(true);

    const ticketingCategory = CONNECTOR_CATEGORIES.find((c) => c.id === "ticketing")!;
    expect(ticketingCategory.nativeIntegration.isActive(state)).toBe(true);

    // No third-party connectors are active by default
    const activeSearchConnector = searchCategory.connectors.find(
      (c) => c.isConfigured && c.isConfigured(state)
    );
    expect(activeSearchConnector).toBeUndefined();

    const activeTicketingConnector = ticketingCategory.connectors.find(
      (c) => c.isConfigured && c.isConfigured(state)
    );
    expect(activeTicketingConnector).toBeUndefined();
  });

  it("activates third-party connector when configured and supersedes native", () => {
    const configuredState: OnboardingState = {
      ...INITIAL_ONBOARDING_STATE,
      search: {
        provider: "algolia",
        appId: "LAT67PQXYZ",
        searchApiKey: "sec_key_123",
        indexName: "prod_catalog"
      },
      ticketing: {
        provider: "zendesk",
        subdomain: "acme",
        clientId: "client_1",
        clientSecret: "secret_1"
      }
    };

    const searchCategory = CONNECTOR_CATEGORIES.find((c) => c.id === "product-search")!;
    const algoliaConnector = searchCategory.connectors.find((c) => c.id === "algolia")!;
    expect(algoliaConnector.isConfigured!(configuredState)).toBe(true);
    expect(searchCategory.nativeIntegration.isActive(configuredState)).toBe(false);

    const ticketingCategory = CONNECTOR_CATEGORIES.find((c) => c.id === "ticketing")!;
    const zendeskConnector = ticketingCategory.connectors.find((c) => c.id === "zendesk")!;
    expect(zendeskConnector.isConfigured!(configuredState)).toBe(true);
    expect(ticketingCategory.nativeIntegration.isActive(configuredState)).toBe(false);
  });

  it("handles future extensible connectors like Stripe and Adyen gracefully", () => {
    const paymentsCategory = CONNECTOR_CATEGORIES.find((c) => c.id === "payments")!;
    expect(paymentsCategory).toBeDefined();

    const connectorIds = paymentsCategory.connectors.map((c) => c.id);
    expect(connectorIds).toContain("stripe");
    expect(connectorIds).toContain("adyen");

    const stripe = paymentsCategory.connectors.find((c) => c.id === "stripe")!;
    expect(stripe.isAvailable).toBe(false);
    expect(stripe.badge).toBe("Coming Soon");
  });
});
