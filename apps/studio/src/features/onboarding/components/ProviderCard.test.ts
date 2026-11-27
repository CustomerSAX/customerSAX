import { describe, expect, it } from "vitest";
import { getProviderLogo } from "./ProviderLogo";

describe("Onboarding Provider Branding and Logos", () => {
  it("resolves official third-party logos for all supported commerce providers", () => {
    expect(getProviderLogo("commercetools")).not.toBeNull();
    expect(getProviderLogo("shopify")).not.toBeNull();
    expect(getProviderLogo("bigcommerce")).not.toBeNull();
  });

  it.each([
    "commercetools",
    "shopify",
    "bigcommerce",
    "sap-commerce-cloud",
    "sap-s4hana",
    "microsoft-dynamics-365",
    "oracle-netsuite",
    "contentful",
    "amplience",
    "adobe-experience-manager",
    "bloomreach-discovery",
    "bloomreach-engagement"
  ])("resolves an official logo for Connection Hub catalog provider %s", (id) => {
    expect(getProviderLogo(id)).not.toBeNull();
  });

  it.each([
    "microsoft-teams",
    "github",
    "jira",
    "confluence",
    "slack",
    "woocommerce",
    "adobe-commerce",
    "salesforce-commerce-cloud",
    "contentstack",
    "zoho-crm"
  ])("resolves an official logo for live connector alias %s", (id) => {
    expect(getProviderLogo(id)).not.toBeNull();
  });

  it("resolves official third-party logo for product search providers", () => {
    expect(getProviderLogo("algolia")).not.toBeNull();
  });

  it("resolves official third-party logos for ticketing providers", () => {
    expect(getProviderLogo("zendesk")).not.toBeNull();
    expect(getProviderLogo("freshdesk")).not.toBeNull();
  });

  it("resolves official third-party logos for payment providers", () => {
    expect(getProviderLogo("stripe")).not.toBeNull();
    expect(getProviderLogo("adyen")).not.toBeNull();
  });

  it("resolves official third-party logos for CRM providers", () => {
    expect(getProviderLogo("salesforce")).not.toBeNull();
    expect(getProviderLogo("hubspot")).not.toBeNull();
  });

  it("resolves official third-party logos for AI providers", () => {
    expect(getProviderLogo("openai")).not.toBeNull();
    expect(getProviderLogo("anthropic")).not.toBeNull();
  });

  it("resolves official logos for third-party UI design system adapters", () => {
    expect(getProviderLogo("mantine")).not.toBeNull();
    expect(getProviderLogo("mui")).not.toBeNull();
  });

  it("returns null for native CSA providers to preserve existing native CSA visuals and icons", () => {
    // Native Product Search
    expect(getProviderLogo("native")).toBeNull();
    // Native Ticketing
    expect(getProviderLogo("internal")).toBeNull();
    // Native CSA Custom Theme
    expect(getProviderLogo("csa-custom")).toBeNull();
    // Unknown or custom IDs
    expect(getProviderLogo("unknown-provider")).toBeNull();
  });

  it("handles case-insensitive provider identifiers", () => {
    expect(getProviderLogo("Shopify")).not.toBeNull();
    expect(getProviderLogo("COMMERCETOOLS")).not.toBeNull();
    expect(getProviderLogo("Zendesk")).not.toBeNull();
    expect(getProviderLogo("OpenAI")).not.toBeNull();
    expect(getProviderLogo("Anthropic")).not.toBeNull();
  });
});
