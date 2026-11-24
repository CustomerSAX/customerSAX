import { describe, expect, it } from "vitest";
import {
  createRefundRecord,
  hasCsaRefundPermission,
  refundFingerprint,
  selectedReturnMaximum,
  sanitizeRefundPayload
} from "./merchant-center-refunds.js";

describe("sanitizeRefundPayload", () => {
  it("normalizes a valid refund request", () => {
    expect(
      sanitizeRefundPayload({
        orderId: " order-1 ",
        returnItemIds: ["return-1", "return-1", " return-2 "],
        amount: { centAmount: 4500, currencyCode: "aud" },
        reason: " Customer Return ",
        note: " Ticket CSA-12 ",
        idempotencyKey: " refund-order-1-return-1 "
      })
    ).toEqual({
      orderId: "order-1",
      returnItemIds: ["return-1", "return-2"],
      amount: { centAmount: 4500, currencyCode: "AUD", fractionDigits: 2 },
      reason: "Customer Return",
      note: "Ticket CSA-12",
      idempotencyKey: "refund-order-1-return-1"
    });
  });

  it("rejects zero amounts and requests without return items", () => {
    expect(
      sanitizeRefundPayload({
        orderId: "order-1",
        returnItemIds: [],
        amount: { centAmount: 0, currencyCode: "AUD" },
        reason: "Customer Return",
        idempotencyKey: "refund-1"
      })
    ).toBeUndefined();
  });
});

describe("hasCsaRefundPermission", () => {
  it("accepts the orders manage permission formats", () => {
    expect(hasCsaRefundPermission(["ManageCsaOrders"])).toBe(true);
    expect(hasCsaRefundPermission(["canManageCsa"])).toBe(true);
  });

  it("rejects view-only permissions", () => {
    expect(hasCsaRefundPermission(["ViewCsaOrders"])).toBe(false);
  });
});

describe("createRefundRecord", () => {
  it("creates a unique refund record identifier", () => {
    expect(createRefundRecord({ centAmount: 4500, currencyCode: "AUD" })).toMatchObject({
      id: expect.stringMatching(/^csa_refund_[a-f0-9]{32}$/),
      amount: 4500,
      currency: "aud"
    });
  });
});

describe("selectedReturnMaximum", () => {
  it("caps a refund to the quantities in the selected return items", () => {
    expect(
      selectedReturnMaximum(
        [
          {
            id: "line-1",
            quantity: 2,
            totalPrice: { centAmount: 9000, currencyCode: "AUD" }
          }
        ],
        [
          {
            id: "return-1",
            lineItemId: "line-1",
            quantity: 1,
            shipmentState: "Returned",
            paymentState: "NotRefunded"
          }
        ]
      )
    ).toBe(4500);
  });
});

describe("refundFingerprint", () => {
  it("is stable for item ordering and changes when the refund request changes", () => {
    const base = {
      orderId: "order-1",
      returnItemIds: ["return-2", "return-1"],
      amount: { centAmount: 4500, currencyCode: "AUD" },
      reason: "Customer Return",
      idempotencyKey: "attempt-1"
    };
    expect(refundFingerprint(base)).toBe(
      refundFingerprint({ ...base, returnItemIds: ["return-1", "return-2"] })
    );
    expect(refundFingerprint(base)).not.toBe(
      refundFingerprint({ ...base, amount: { ...base.amount, centAmount: 4400 } })
    );
  });
});
