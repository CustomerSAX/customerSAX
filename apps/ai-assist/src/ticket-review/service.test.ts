import { describe, expect, it, vi } from "vitest";
import { createReviewService } from "./service.js";
import type {
  Analysis,
  ContactCustomer,
  Review,
  ReviewStore,
  ReviewTicket,
  ReviewOrder,
  OrderFindings
} from "./types.js";

const scope = {
  clientId: "tenant-a",
  projectKey: "project-a",
  userEmail: "agent@example.com"
};
function fixture() {
  const records = new Map<string, Review>();
  const store: ReviewStore = {
    async get(id) {
      return structuredClone(records.get(id) ?? null);
    },
    async insert(review) {
      if (records.has(review._id)) return false;
      records.set(review._id, structuredClone(review));
      return true;
    },
    async change(id, revision, statuses, patch, event) {
      const old = records.get(id);
      if (!old || old.revision !== revision || !statuses.includes(old.status))
        return null;
      const next = { ...old, ...patch, audit: [...old.audit, event] };
      records.set(id, structuredClone(next));
      return structuredClone(next);
    }
  };
  const ticket: ReviewTicket = {
    id: "ticket-1",
    subject: "Update contact number",
    message: "Update my contact number to 14692466072",
    customerId: "customer-1",
    customerEmail: "customer@example.com",
    status: "open",
    lastModifiedAt: "2026-10-05"
  };
  const customer: ContactCustomer = {
    id: "customer-1",
    email: "customer@example.com",
    version: 4,
    targets: [{ id: "address-1", label: "Main Street, US", phone: "1234567890" }]
  };
  const analysis: Analysis = {
    summary: "Customer requests a contact-number change.",
    intent: "update_contact_number",
    phone: "14692466072",
    evidence: ticket.message,
    explanation: "Update the contact number."
  };
  const execute = vi.fn(async () => ({ version: 5, phone: "14692466072" }));
  const analyze = vi.fn(async () => structuredClone(analysis));
  const draftResolution = vi.fn(
    async () =>
      "Updated the customer address phone number to 14692466072. CT confirmed the update."
  );
  const closeTicket = vi.fn(async () => ({
    ...ticket,
    status: "Closed",
    lastModifiedAt: "2026-10-06"
  }));
  const order: ReviewOrder = {
    id: "order-1",
    version: 4,
    customerId: ticket.customerId,
    customerEmail: ticket.customerEmail,
    orderNumber: "1001",
    orderState: "Open",
    shipmentState: "Pending",
    paymentState: "Pending"
  };
  const findings: OrderFindings = {
    summary: "Order inquiry",
    actions: ["Confirm order status with customer"],
    responseDraft: "Your order is awaiting shipment.",
    missingInformation: []
  };
  const executeOrder = vi.fn(async () => {
    order.version = 5;
    return { id: order.id, version: 5 };
  });
  const requestInformation = vi.fn(async () => ({ status: "accepted", recipient: ticket.customerEmail, subject: "More details", text: "Please provide the new phone number.", createdAt: "2026-10-08" }));
  const service = createReviewService({
    requestInformation,
    store,
    order: async () => structuredClone(order),
    analyzeOrder: async () => structuredClone(findings),
    executeOrder,
    ticket: async () => structuredClone(ticket),
    customer: async () => structuredClone(customer),
    analyze,
    closeTicket,
    draftResolution,
    execute
  });
  return {
    requestInformation,
    order,
    findings,
    executeOrder,
    service,
    ticket,
    customer,
    analysis,
    execute,
    analyze,
    closeTicket,
    draftResolution,
    records,
    store
  };
}

describe("persistent ticket proposal approval", () => {
  it("prepares the reported international number despite reformatted AI evidence", async () => {
    const f = fixture();
    f.ticket.subject = "Update contact details";
    f.ticket.message = "Update contact details to +91 7699496625";
    f.analysis.phone = "+91\u00a07699496625";
    f.analysis.evidence = `${f.ticket.message}.`;
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("pending");
    expect(proposal.action?.phone).toBe("+91 7699496625");
    expect(f.execute).not.toHaveBeenCalled();
  });
  it("prefills resolution after success and saves the agent's edited text with closure", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(f.draftResolution).not.toHaveBeenCalled();
    const completed = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );
    expect(completed.resolutionDraft).toContain("14692466072");
    const result = await f.service.decideClosure(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve_close",
      "  Agent edited this note.  "
    );
    expect(f.closeTicket).toHaveBeenCalledWith(
      f.ticket.id,
      f.ticket.lastModifiedAt,
      "Agent edited this note."
    );
    expect(result?.resolutionNotes).toBe("Agent edited this note.");
    expect(
      result?.audit.find((entry) => entry.event === "closure_approved")?.resolutionNotes
    ).toBe("Agent edited this note.");
  });

  it("rejects empty and oversized notes without closing", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    for (const text of [undefined, "   ", "x".repeat(5001)]) {
      await expect(
        f.service.decideClosure(
          scope,
          f.ticket.id,
          proposal.revision,
          "approve_close",
          text
        )
      ).rejects.toThrow("resolution notes");
    }
    expect(f.closeTicket).not.toHaveBeenCalled();
  });

  it("uses a factual fallback when drafting fails and backfills older completed reviews", async () => {
    const f = fixture();
    f.draftResolution.mockRejectedValue(new Error("model unavailable"));
    const proposal = await f.service.prepare(scope, f.ticket.id);
    const completed = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );
    expect(completed.status).toBe("succeeded");
    expect(completed.resolutionDraft).toContain("14692466072");
    const stored = f.records.get(proposal._id)!;
    delete stored.resolutionDraft;
    expect((await f.service.prepare(scope, f.ticket.id)).resolutionDraft).toContain(
      "14692466072"
    );
    expect(f.execute).toHaveBeenCalledTimes(1);
  });
  it("requires a second approval to close, closes only once, and does not repeat CT on reload", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await f.service.decideClosure(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve_close",
      "Agent-reviewed resolution"
    );
    expect(f.closeTicket).not.toHaveBeenCalled();
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    expect(f.closeTicket).not.toHaveBeenCalled();
    await Promise.all([
      f.service.decideClosure(
        scope,
        f.ticket.id,
        proposal.revision,
        "approve_close",
        "Agent-reviewed resolution"
      ),
      f.service.decideClosure(
        scope,
        f.ticket.id,
        proposal.revision,
        "approve_close",
        "Agent-reviewed resolution"
      )
    ]);
    expect(f.closeTicket).toHaveBeenCalledTimes(1);
    expect(f.closeTicket).toHaveBeenCalledWith(
      f.ticket.id,
      f.ticket.lastModifiedAt,
      "Agent-reviewed resolution"
    );
    const saved = await f.service.load(scope, f.ticket.id);
    expect(saved).toMatchObject({ status: "closed", closeApprovedBy: scope.userEmail });
    f.ticket.status = "Closed";
    f.ticket.lastModifiedAt = "2026-10-06";
    expect((await f.service.prepare(scope, f.ticket.id)).status).toBe("closed");
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(f.analyze).toHaveBeenCalledTimes(1);
  });

  it("persists keep-open without closing or repeating the CT action", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    expect(
      (await f.service.decideClosure(scope, f.ticket.id, proposal.revision, "keep_open"))
        ?.status
    ).toBe("kept_open");
    await f.service.decideClosure(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve_close",
      "Agent-reviewed resolution"
    );
    expect(f.closeTicket).not.toHaveBeenCalled();
  });

  it("blocks closing a changed ticket and checks closure approval revision/tenant", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    await expect(
      f.service.decideClosure(
        scope,
        f.ticket.id,
        "old-revision",
        "approve_close",
        "Agent-reviewed resolution"
      )
    ).rejects.toThrow();
    await expect(
      f.service.decideClosure(
        { ...scope, clientId: "other" },
        f.ticket.id,
        proposal.revision,
        "approve_close",
        "Agent-reviewed resolution"
      )
    ).rejects.toThrow();
    f.ticket.message = "I have another issue";
    expect(
      (
        await f.service.decideClosure(
          scope,
          f.ticket.id,
          proposal.revision,
          "approve_close",
          "Agent-reviewed resolution"
        )
      )?.status
    ).toBe("close_stale");
    expect(f.closeTicket).not.toHaveBeenCalled();
  });

  it("does not retry uncertain ticket closure", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    f.closeTicket.mockRejectedValue(new Error("timeout"));
    expect(
      (
        await f.service.decideClosure(
          scope,
          f.ticket.id,
          proposal.revision,
          "approve_close",
          "Agent-reviewed resolution"
        )
      )?.status
    ).toBe("close_uncertain");
    await f.service.decideClosure(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve_close",
      "Agent-reviewed resolution"
    );
    expect(f.closeTicket).toHaveBeenCalledTimes(1);
  });
  it("prepares the exact before/after change without writing CT", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("pending");
    expect(proposal.action).toMatchObject({
      previousPhone: "1234567890",
      phone: "14692466072",
      expectedVersion: 4,
      addressId: "address-1"
    });
    expect(f.execute).not.toHaveBeenCalled();
    expect((await f.service.load(scope, f.ticket.id))?.revision).toBe(proposal.revision);
    await f.service.prepare(scope, f.ticket.id);
    expect(f.analyze).toHaveBeenCalledTimes(1);
  });

  it("executes once for concurrent and repeated approvals, recording the approver", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await Promise.all([
      f.service.decide(scope, f.ticket.id, proposal.revision, "approve"),
      f.service.decide(scope, f.ticket.id, proposal.revision, "approve")
    ]);
    const result = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "succeeded",
      approvedBy: scope.userEmail,
      result: { phone: "14692466072", version: 5 }
    });
    expect(result.audit.map((event) => event.event)).toContain("execution_succeeded");
  });

  it("declines without writes and rejects an old approval after regenerating", async () => {
    const f = fixture();
    const first = await f.service.prepare(scope, f.ticket.id);
    expect(
      (await f.service.decide(scope, f.ticket.id, first.revision, "decline")).status
    ).toBe("declined");
    const second = await f.service.prepare(scope, f.ticket.id, true);
    expect(second.revision).not.toBe(first.revision);
    await expect(
      f.service.decide(scope, f.ticket.id, first.revision, "approve")
    ).rejects.toThrow("proposal changed");
    expect(f.execute).not.toHaveBeenCalled();
  });

  it.each(["ticket", "customer"])("blocks a stale %s", async (resource) => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    if (resource === "ticket") f.ticket.message = "Do not update my number";
    else f.customer.version = 5;
    expect(
      (await f.service.decide(scope, f.ticket.id, proposal.revision, "approve")).status
    ).toBe("stale");
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("isolates tenant/project proposals and approvals", async () => {
    const f = fixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    const otherScope = { ...scope, clientId: "tenant-b" };
    expect(await f.service.load(otherScope, f.ticket.id)).toBeNull();
    await expect(
      f.service.decide(otherScope, f.ticket.id, proposal.revision, "approve")
    ).rejects.toThrow();
    expect(f.execute).not.toHaveBeenCalled();
  });

  it.each(["invented number", "missing customer", "mismatched email", "unsupported"])(
    "does not prepare an action for %s",
    async (condition) => {
      const f = fixture();
      if (condition === "invented number") f.analysis.phone = "9999999999";
      if (condition === "missing customer") f.ticket.customerId = null;
      if (condition === "mismatched email") f.customer.email = "other@example.com";
      if (condition === "unsupported") f.analysis.intent = "unsupported";
      const proposal = await f.service.prepare(scope, f.ticket.id);
      expect(proposal.status).toBe("blocked");
      expect(proposal.action).toBeNull();
      await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
      expect(f.execute).not.toHaveBeenCalled();
    }
  );

  it("requires an explicit address when multiple addresses exist", async () => {
    const f = fixture();
    f.customer.targets.push({
      id: "address-2",
      label: "Other Street",
      phone: "2222222222"
    });
    const first = await f.service.prepare(scope, f.ticket.id);
    expect(first.status).toBe("blocked");
    const selected = await f.service.prepare(scope, f.ticket.id, true, "address-2");
    expect(selected.action?.addressId).toBe("address-2");
    const invalid = await f.service.prepare(
      scope,
      f.ticket.id,
      true,
      "unrelated-address"
    );
    expect(invalid.status).toBe("blocked");
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("does not retry an uncertain write, even after reanalysis", async () => {
    const f = fixture();
    f.execute.mockRejectedValue(new Error("Timeout after dispatch"));
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(
      (await f.service.decide(scope, f.ticket.id, proposal.revision, "approve")).status
    ).toBe("uncertain");
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    await f.service.prepare(scope, f.ticket.id, true);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it("fails closed if durable storage is unavailable", async () => {
    const f = fixture();
    f.store.insert = async () => {
      throw new Error("Mongo unavailable");
    };
    await expect(f.service.prepare(scope, f.ticket.id)).rejects.toThrow(
      "Mongo unavailable"
    );
    expect(f.analyze).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
  });
});

describe("order inquiry approval", () => {
  function orderFixture() {
    const f = fixture();
    f.ticket.category = "order_inquiry";
    f.ticket.orderNumber = "1001";
    f.ticket.subject = "Where is my order?";
    return f;
  }
  it("prepares findings without writes and closes only after separate approval with notes", async () => {
    const f = orderFixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("pending");
    expect(proposal.orderProposal?.responseDraft).toBe(f.findings.responseDraft);
    expect(f.executeOrder).not.toHaveBeenCalled();
    await f.service.decideClosure(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve_close",
      "Resolved"
    );
    expect(f.closeTicket).not.toHaveBeenCalled();
    const approved = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );
    expect(approved.findingsApproved).toBe(true);
    expect(approved.resolutionDraft).toContain("not sent");
    await f.service.decideClosure(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve_close",
      "Shared status with customer; inquiry resolved."
    );
    expect(f.closeTicket).toHaveBeenCalledWith(
      f.ticket.id,
      f.ticket.lastModifiedAt,
      "Shared status with customer; inquiry resolved."
    );
    expect(f.execute).not.toHaveBeenCalled();
  });
  it("blocks orders belonging to another customer", async () => {
    const f = orderFixture();
    f.order.customerId = "other";
    expect((await f.service.prepare(scope, f.ticket.id)).status).toBe("blocked");
  });
  it("prepares guest order findings using the verified profile email", async () => {
    const f = orderFixture();
    f.order.customerId = null;
    f.order.customerEmail = " CUSTOMER@example.com ";
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("pending");
    expect(proposal.orderProposal?.actions).toEqual(f.findings.actions);
    const approved = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );
    expect(approved.findingsApproved).toBe(true);
    expect(f.executeOrder).not.toHaveBeenCalled();
  });
  it("retains guest order findings but requires an account link for writes", async () => {
    const f = orderFixture();
    f.order.customerId = null;
    f.findings.requestedAction = "cancel_order";
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("blocked");
    expect(proposal.orderProposal?.actions).toEqual(f.findings.actions);
    expect(proposal.explanation).toContain("linked to this customer account");
    expect(proposal.orderAction).toBeUndefined();
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    expect(f.executeOrder).not.toHaveBeenCalled();
  });
  it("uses a matching account ID despite an old order email", async () => {
    const f = orderFixture();
    f.order.customerEmail = "old@example.com";
    expect((await f.service.prepare(scope, f.ticket.id)).status).toBe("pending");
  });
  it("does not trust a ticket email that differs from the customer profile", async () => {
    const f = orderFixture();
    f.order.customerId = null;
    f.ticket.customerEmail = f.order.customerEmail = "other@example.com";
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("blocked");
    expect(proposal.orderProposal).toBeUndefined();
    expect(proposal.explanation).toContain("current customer profile");
  });
  it("rejects guest orders without a matching email", async () => {
    const f = orderFixture();
    f.order.customerId = null;
    f.order.customerEmail = null;
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("blocked");
    expect(proposal.orderProposal).toBeUndefined();
  });
  it("rechecks the customer profile before approving findings", async () => {
    const f = orderFixture();
    f.order.customerId = null;
    const proposal = await f.service.prepare(scope, f.ticket.id);
    f.customer.email = "changed@example.com";
    expect(
      (await f.service.decide(scope, f.ticket.id, proposal.revision, "approve")).status
    ).toBe("stale");
    expect(f.executeOrder).not.toHaveBeenCalled();
  });
  it("rejects approval after the order changes", async () => {
    const f = orderFixture();
    f.findings.requestedAction = "cancel_order";
    const proposal = await f.service.prepare(scope, f.ticket.id);
    f.order.version = 6;
    expect(
      (await f.service.decide(scope, f.ticket.id, proposal.revision, "approve")).status
    ).toBe("stale");
    expect(f.executeOrder).not.toHaveBeenCalled();
  });
  it("executes a cancellation once under concurrent approvals and saves confirmed details", async () => {
    const f = orderFixture();
    f.findings.requestedAction = "cancel_order";
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await Promise.all([
      f.service.decide(scope, f.ticket.id, proposal.revision, "approve"),
      f.service.decide(scope, f.ticket.id, proposal.revision, "approve")
    ]);
    expect(f.executeOrder).toHaveBeenCalledTimes(1);
    const saved = await f.service.load(scope, f.ticket.id);
    expect(saved?.resolutionDraft).toContain("Cancelled");
    expect(saved?.orderResult?.version).toBe(5);
    expect(f.closeTicket).not.toHaveBeenCalled();
    await f.service.decideClosure(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve_close",
      "Cancellation confirmed. No refund required."
    );
    expect(f.closeTicket).toHaveBeenCalledTimes(1);
  });
  it("blocks automated cancellation with payment activity", async () => {
    const f = orderFixture();
    f.findings.requestedAction = "cancel_order";
    f.order.paymentState = "Paid";
    expect((await f.service.prepare(scope, f.ticket.id)).status).toBe("blocked");
    expect(f.executeOrder).not.toHaveBeenCalled();
  });
  it("never repeats an order write after uncertain execution", async () => {
    const f = orderFixture();
    f.findings.requestedAction = "cancel_order";
    f.executeOrder.mockRejectedValue(new Error("timeout"));
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(
      (await f.service.decide(scope, f.ticket.id, proposal.revision, "approve")).status
    ).toBe("uncertain");
    await f.service.prepare(scope, f.ticket.id, true);
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    expect(f.executeOrder).toHaveBeenCalledTimes(1);
    expect(f.closeTicket).not.toHaveBeenCalled();
  });
  it("keeps completed order actions saved across refreshes", async () => {
    const f = orderFixture();
    f.findings.requestedAction = "cancel_order";
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    f.ticket.message = "Updated ticket";
    expect((await f.service.prepare(scope, f.ticket.id, true)).orderResult).toBeDefined();
    expect(f.executeOrder).toHaveBeenCalledTimes(1);
  });
  it("requires reviewing an order again if it changes before closure", async () => {
    const f = orderFixture();
    const proposal = await f.service.prepare(scope, f.ticket.id);
    await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
    f.order.version = 7;
    expect(
      (
        await f.service.decideClosure(
          scope,
          f.ticket.id,
          proposal.revision,
          "approve_close",
          "Done"
        )
      )?.status
    ).toBe("close_stale");
    expect(f.closeTicket).not.toHaveBeenCalled();
  });
});


describe("automatic missing-information email", () => {
  it("requests missing phone details without executing any account change", async () => {
    const f = fixture();
    f.ticket.message = "Please update my phone number";
    Object.assign(f.analysis, { intent: "needs_information", phone: null, evidence: null, customerQuestions: ["new_phone_number"] });
    const review = await f.service.prepare(scope, f.ticket.id);
    expect(f.requestInformation).toHaveBeenCalledWith(f.ticket, ["new_phone_number"]);
    expect(review.informationRequest?.status).toBe("accepted");
    expect(f.execute).not.toHaveBeenCalled();
    await f.service.prepare(scope, f.ticket.id);
    expect(f.requestInformation).toHaveBeenCalledTimes(1);
  });
  it("does not email complete requests, internal blockers, or closed tickets", async () => {
    const f = fixture();
    await f.service.prepare(scope, f.ticket.id);
    expect(f.requestInformation).not.toHaveBeenCalled();
    f.ticket.status = "closed";
    Object.assign(f.analysis, { intent: "needs_information", customerQuestions: ["new_phone_number"] });
    await f.service.prepare(scope, f.ticket.id, true);
    expect(f.requestInformation).not.toHaveBeenCalled();
  });
  it("retains the proposal and reports an uncertain email failure", async () => {
    const f = fixture();
    Object.assign(f.analysis, { intent: "needs_information", customerQuestions: ["clarify_request"] });
    f.requestInformation.mockRejectedValue(new Error("unavailable"));
    const review = await f.service.prepare(scope, f.ticket.id);
    expect(review.status).toBe("blocked");
    expect(review.informationRequestError).toContain("could not be confirmed");
    expect(f.execute).not.toHaveBeenCalled();
  });
});
