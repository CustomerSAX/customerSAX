import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../commercetools/auth.js", () => ({
  getCommercetoolsToken: async () => "test-token"
}));
vi.mock("../../../commercetools/project-config.js", () => ({
  resolveCommercetoolsProject: async () => ({
    apiUrl: "https://ct.example",
    projectKey: "project"
  })
}));
import {
  customerContactTargets,
  updateCustomerContactNumber
} from "./customer-contact.js";

afterEach(() => vi.unstubAllGlobals());
const address = {
  id: "a1",
  key: "home",
  country: "US",
  city: "Austin",
  phone: "1234567890",
  mobile: "4444444444",
  additionalStreetInfo: "Unit B",
  custom: {
    type: { typeId: "type", id: "custom-type" },
    fields: { deliveryNote: "Side door" }
  }
};
const customer = {
  id: "c1",
  email: "customer@example.com",
  version: 3,
  addresses: [address]
};

describe("CT contact-number update", () => {
  it("reads target numbers without sending a mutation", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(customer));
    vi.stubGlobal("fetch", fetcher);
    expect(await customerContactTargets("c1")).toMatchObject({
      version: 3,
      targets: [{ id: "a1", phone: "1234567890" }]
    });
    expect(fetcher.mock.calls[0][1].method).toBe("GET");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves address/custom/mobile fields and uses the approved version", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(customer))
      .mockResolvedValueOnce(
        Response.json({
          ...customer,
          version: 4,
          addresses: [{ ...address, phone: "14692466072" }]
        })
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await updateCustomerContactNumber({
      id: "c1",
      addressId: "a1",
      expectedVersion: 3,
      phone: "14692466072"
    });
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.version).toBe(3);
    expect(body.actions).toEqual([
      {
        action: "changeAddress",
        addressId: "a1",
        address: {
          key: "home",
          country: "US",
          city: "Austin",
          phone: "14692466072",
          mobile: address.mobile,
          additionalStreetInfo: "Unit B",
          custom: address.custom
        }
      }
    ]);
    expect(result).toMatchObject({ phone: "14692466072", version: 4 });
  });
  it("rejects stale customer versions before writing", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...customer, version: 4 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      updateCustomerContactNumber({
        id: "c1",
        addressId: "a1",
        expectedVersion: 3,
        phone: "14692466072"
      })
    ).rejects.toThrow("Customer changed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never retries failed writes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(customer))
      .mockRejectedValueOnce(new Error("timeout"));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      updateCustomerContactNumber({
        id: "c1",
        addressId: "a1",
        expectedVersion: 3,
        phone: "14692466072"
      })
    ).rejects.toThrow("timeout");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
