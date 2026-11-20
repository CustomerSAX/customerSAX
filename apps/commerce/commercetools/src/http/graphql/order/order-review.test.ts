import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../commercetools/auth.js", () => ({
  getCommercetoolsToken: async () => "test"
}));
vi.mock("../../../commercetools/project-config.js", () => ({
  resolveCommercetoolsProject: async () => ({
    apiUrl: "https://ct.example",
    projectKey: "project"
  })
}));
import { updateReviewedOrder } from "./order-review.js";
afterEach(() => vi.unstubAllGlobals());
const order = {
  id: "o1",
  customerId: "c1",
  version: 3,
  orderState: "Open",
  shipmentState: "Pending",
  paymentState: "Pending",
  createdAt: new Date().toISOString(),
  lineItems: [{ id: "line-1", quantity: 1, name: { "en-US": "Quilt Cover" } }],
  returnInfo: [],
  shippingAddress: {
    country: "US",
    state: "TX",
    postalCode: "78701",
    city: "Austin",
    streetName: "Old Street",
    phone: "1234567890",
    firstName: "Sam",
    custom: { type: { id: "type1", typeId: "type" }, fields: { note: "Door" } }
  }
};
const args = {
  id: "o1",
  customerId: "c1",
  expectedVersion: 3,
  action: { kind: "cancel_order" }
};
describe("approved order writes", () => {
  it.each([
    { version: 4 },
    { customerId: "other" },
    { orderState: "Cancelled" },
    { shipmentState: "Shipped" },
    { paymentState: "Paid" },
    { paymentInfo: { payments: [{ id: "p1" }] } }
  ])("rejects ineligible or stale orders before writing: %j", async (patch) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...order, ...patch }));
    vi.stubGlobal("fetch", fetcher);
    await expect(updateReviewedOrder(args)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses exactly the approved version for cancellation", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(order))
      .mockResolvedValueOnce(
        Response.json({ ...order, version: 4, orderState: "Cancelled" })
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await updateReviewedOrder(args)).toMatchObject({
      version: 4,
      orderState: "Cancelled"
    });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      version: 3,
      actions: [{ action: "changeOrderState", orderState: "Cancelled" }]
    });
  });
  it("preserves recipient and custom fields when updating a shipping address", async () => {
    const address = {
      streetName: "New Street",
      streetNumber: "12",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US"
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(order))
      .mockResolvedValueOnce(
        Response.json({
          ...order,
          version: 4,
          shippingAddress: { ...order.shippingAddress, ...address }
        })
      );
    vi.stubGlobal("fetch", fetcher);
    await updateReviewedOrder({
      ...args,
      action: { kind: "change_shipping_address", address }
    });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).actions).toEqual([
      { action: "setShippingAddress", address: { ...order.shippingAddress, ...address } }
    ]);
  });
  it("records exactly the approved return items after rechecking eligibility", async () => {
    const returnable = {
      ...order,
      orderState: "Complete",
      shipmentState: "Delivered",
      paymentState: "Paid"
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(returnable))
      .mockImplementationOnce(async (_url, init) => {
        const body = JSON.parse(init.body);
        const tracking = body.actions[0].returnTrackingId;
        return Response.json({
          ...returnable,
          version: 4,
          returnInfo: [{ returnTrackingId: tracking, items: body.actions[0].items }]
        });
      });
    vi.stubGlobal("fetch", fetcher);

    const result = await updateReviewedOrder({
      ...args,
      action: {
        kind: "start_return",
        reason: "It does not suit what I need",
        lineItems: [{ lineItemId: "line-1", quantity: 1 }]
      }
    });

    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.version).toBe(3);
    expect(body.actions[0]).toMatchObject({
      action: "addReturnInfo",
      items: [{
        lineItemId: "line-1",
        quantity: 1,
        shipmentState: "Returned",
        comment: "It does not suit what I need"
      }]
    });
    expect(result.returnTrackingId).toMatch(/^CSA-RETURN-/);
  });
  it("rejects duplicate return lines before writing", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        ...order,
        orderState: "Complete",
        shipmentState: "Delivered",
        paymentState: "Paid"
      })
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(
      updateReviewedOrder({
        ...args,
        action: {
          kind: "start_return",
          reason: "No longer needed",
          lineItems: [
            { lineItemId: "line-1", quantity: 1 },
            { lineItemId: "line-1", quantity: 1 }
          ]
        }
      })
    ).rejects.toThrow("quantity");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects address changes that need tax review", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(order));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      updateReviewedOrder({
        ...args,
        action: {
          kind: "change_shipping_address",
          address: {
            streetName: "New Street",
            city: "Dallas",
            state: "TX",
            country: "US",
            postalCode: "75001"
          }
        }
      })
    ).rejects.toThrow("tax");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never retries a failed write", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(order))
      .mockRejectedValueOnce(new Error("timeout"));
    vi.stubGlobal("fetch", fetcher);
    await expect(updateReviewedOrder(args)).rejects.toThrow("timeout");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
