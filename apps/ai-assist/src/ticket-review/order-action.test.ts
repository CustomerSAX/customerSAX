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

describe("grounded return proposals", () => {
  const returnTicket: ReviewTicket = {
    ...ticket,
    category: "returns_refunds",
    subject: "Return Quilt Cover",
    message:
      "I'd like to return the Jolly & Joy Christmas Highland Quilt Cover Set. It doesn't suit what I need.",
    orderNumber: "1001"
  };
  const returnOrder: ReviewOrder = {
    ...order,
    orderState: "Complete",
    shipmentState: "Delivered",
    paymentState: "Paid",
    createdAt: new Date().toISOString(),
    lineItems: [
      {
        id: "line-1",
        name: "Jolly & Joy Christmas Highland Quilt Cover Set",
        sku: "QUILT-1",
        quantity: 1
      }
    ],
    returnInfo: []
  };
  const returnFindings: OrderFindings = {
    summary: "Customer requests a return.",
    actions: ["Record the return after approval."],
    responseDraft: "We can help with your return.",
    missingInformation: [],
    requestedAction: "start_return",
    returnReason: "It doesn't suit what I need",
    returnReasonEvidence: "It doesn't suit what I need.",
    returnItems: [
      {
        lineItemId: "line-1",
        quantity: 1,
        evidence: "return the Jolly & Joy Christmas Highland Quilt Cover Set"
      }
    ]
  };

  it("prepares an exact eligible return from ticket evidence", () => {
    expect(prepareOrderAction(returnTicket, returnOrder, returnFindings).action).toEqual({
      kind: "start_return",
      reason: "It doesn't suit what I need",
      lineItems: [
        {
          lineItemId: "line-1",
          quantity: 1,
          name: "Jolly & Joy Christmas Highland Quilt Cover Set",
          sku: "QUILT-1"
        }
      ]
    });
  });

  it("blocks invented reasons and ineligible orders", () => {
    expect(
      prepareOrderAction(returnTicket, returnOrder, {
        ...returnFindings,
        returnReason: "Damaged",
        returnReasonEvidence: "Damaged"
      }).action
    ).toBeUndefined();
    expect(
      prepareOrderAction(
        returnTicket,
        { ...returnOrder, shipmentState: "Pending" },
        returnFindings
      ).reason
    ).toContain("not currently eligible");
  });
});
