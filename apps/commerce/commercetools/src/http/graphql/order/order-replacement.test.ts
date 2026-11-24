import { describe, expect, it } from "vitest";
import {
  assertMatchingReplacement,
  replacementCartKey,
  replacementReference
} from "./order-replacement.js";

describe("replacement order identity", () => {
  it("creates a stable order reference and cart key", () => {
    const reference = replacementReference("order-1", "return-1");
    expect(reference).toBe("CSA-RPL:order-1:return-1");
    expect(replacementCartKey(reference)).toMatch(/^csa-rpl-[a-f0-9]{32}$/);
    expect(replacementCartKey(reference)).toBe(replacementCartKey(reference));
  });

  it("accepts an exact retry and rejects changed replacement details", () => {
    const resource = {
      id: "replacement-1",
      lineItems: [{ quantity: 1, variant: { sku: "SKU-M" } }]
    };
    expect(() => assertMatchingReplacement(resource, "SKU-M", 1)).not.toThrow();
    expect(() => assertMatchingReplacement(resource, "SKU-L", 1)).toThrow(
      /different SKU or quantity/
    );
  });
});
