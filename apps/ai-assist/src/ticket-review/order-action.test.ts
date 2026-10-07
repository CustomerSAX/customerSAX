import { describe, expect, it } from "vitest";
import { prepareOrderAction } from "./order-action.js";
import type { OrderFindings, ReviewOrder, ReviewTicket } from "./types.js";
const address = {
  streetName: "New Street",
  streetNumber: "12",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  country: "US"
};
const ticket: ReviewTicket = {
  id: "t1",
  customerId: "customer-1",
  customerEmail: "a@example.com",
  subject: "Change shipping address",
  message: "Please change to 12 New Street, Austin, TX 78701, US",
  status: "Open"
};
const order: ReviewOrder = {
  id: "o1",
  customerId: "customer-1",
  version: 3,
  orderState: "Open",
  shipmentState: "Ready",
  shippingAddress: address
};
const findings: OrderFindings = {
  summary: "Address change",
  actions: ["Update shipping address"],
  responseDraft: "We can review this change.",
  missingInformation: [],
  requestedAction: "change_shipping_address",
  address
};
describe("grounded shipping address proposals", () => {
  it("accepts complete address fields quoted in the request", () => {
    expect(prepareOrderAction(ticket, order, findings).action).toEqual({
      kind: "change_shipping_address",
      address
    });
  });
  it("rejects an invented address field", () => {
    expect(
      prepareOrderAction(ticket, order, {
        ...findings,
        address: { ...address, streetName: "Other Street" }
      }).action
    ).toBeUndefined();
  });
  it("rejects missing required fields", () => {
    expect(
      prepareOrderAction(ticket, order, {
        ...findings,
        address: { ...address, postalCode: "" }
      }).reason
    ).toContain("complete");
  });
  it("rejects destination changes that require tax review", () => {
    expect(
      prepareOrderAction(
        ticket,
        { ...order, shippingAddress: { ...address, postalCode: "78702" } },
        findings
      ).reason
    ).toContain("tax");
  });
});
