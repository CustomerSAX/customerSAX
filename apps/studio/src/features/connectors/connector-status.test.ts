import { describe, expect, it } from "vitest";
import { activeConnectorId } from "./connector-status";
import type { OnboardingState } from "../onboarding/types";

const state = (patch: Partial<OnboardingState>) => ({ ...patch }) as OnboardingState;

describe("saved connector selection", () => {
  it.each(["zendesk", "freshdesk", "internal"] as const)("shows %s without requiring returned credentials", provider => {
    expect(activeConnectorId("ticketing", state({ ticketing: { provider } }))).toBe(provider);
  });
  it("uses native ticketing when no provider is saved", () => {
    expect(activeConnectorId("ticketing", state({}))).toBe("internal");
  });
  it("shows the saved AI provider without exposing its API key", () => {
    expect(activeConnectorId("ai", state({ aiSettings: { enabled: true, provider: "anthropic", displayName: "Assistant", model: "configured-model" } }))).toBe("anthropic");
  });
  it("tracks search and CRM provider changes", () => {
    expect(activeConnectorId("product-search", state({ search: { provider: "algolia" } }))).toBe("algolia");
    expect(activeConnectorId("crm", state({ crm: { provider: "salesforce" } }))).toBe("salesforce");
    expect(activeConnectorId("crm", state({ crm: { provider: "none" } }))).toBe("native-crm");
  });
});
