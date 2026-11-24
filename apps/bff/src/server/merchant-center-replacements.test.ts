import { describe, expect, it } from "vitest";
import {
  hasCsaReplacementPermission,
  sanitizeReplacementPayload
} from "./merchant-center-replacements.js";

describe("sanitizeReplacementPayload", () => {
  it("normalizes a valid item replacement request", () => {
    expect(
      sanitizeReplacementPayload({
        orderId: " order-1 ",
        returnItemId: " return-1 ",
        replacementSku: " SKU-NEW ",
        quantity: 1,
        reason: " Wrong size ",
        note: " Customer requested medium "
      })
    ).toEqual({
      orderId: "order-1",
      returnItemId: "return-1",
      replacementSku: "SKU-NEW",
      quantity: 1,
      reason: "Wrong size",
      note: "Customer requested medium"
    });
  });

  it("rejects missing SKUs and fractional quantities", () => {
    expect(
      sanitizeReplacementPayload({
        orderId: "order-1",
        returnItemId: "return-1",
        replacementSku: "",
        quantity: 1.5,
        reason: "Wrong size"
      })
    ).toBeUndefined();
  });
});

describe("hasCsaReplacementPermission", () => {
  it("accepts order managers and rejects view-only users", () => {
    expect(hasCsaReplacementPermission(["ManageCsaOrders"])).toBe(true);
    expect(hasCsaReplacementPermission(["canManageCsa"])).toBe(true);
    expect(hasCsaReplacementPermission(["ViewCsaOrders"])).toBe(false);
  });
});
