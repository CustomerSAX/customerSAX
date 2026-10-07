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
