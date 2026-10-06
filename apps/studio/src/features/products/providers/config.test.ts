import { describe, expect, it } from "vitest";
import { productsProvider } from "./config";

describe("Products provider configuration", () => {
  it("preserves CT as the default", () => {
    expect(productsProvider(undefined)).toBe("commercetools");
    expect(productsProvider("")).toBe("commercetools");
  });
  it("selects either supported provider", () => {
    expect(productsProvider(" algolia ")).toBe("algolia");
    expect(productsProvider("commercetools")).toBe("commercetools");
  });
  it("rejects unsupported providers rather than silently using another catalog", () => {
    expect(() => productsProvider("typo")).toThrow("Products provider");
  });
});
