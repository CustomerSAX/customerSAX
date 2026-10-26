import { describe, expect, it } from "vitest";
import { NATIVE_CONNECTOR_CATEGORIES } from "./connectors.config";
import { INITIAL_ONBOARDING_STATE, STEPS } from "./constants";

describe("native connector onboarding", () => {
  it("retains the six-step organization setup", () => {
    expect(STEPS).toHaveLength(6);
    expect(STEPS.map((step) => step.navLabel)).toEqual([
      "Organization",
      "Appearance",
      "Projects",
      "Connectors",
      "Team & Access",
      "Review & Launch"
    ]);
  });
  it("defaults new organizations to built-in capabilities", () => {
    expect(NATIVE_CONNECTOR_CATEGORIES.map((category) => category.id)).toEqual([
      "product-search",
      "ticketing",
      "payments",
      "ai",
      "communication",
      "sso",
      "crm"
    ]);
    expect(
      NATIVE_CONNECTOR_CATEGORIES.every((category) =>
        category.nativeIntegration.isActive(INITIAL_ONBOARDING_STATE)
      )
    ).toBe(true);
  });
});
