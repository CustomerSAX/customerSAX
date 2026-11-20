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
    queryAnswers: [{
      query: "Update my contact number",
      answer: "Update the phone field on the customer's selected address.",
      status: "answered"
    }],
    actions: ["Confirm the customer address to update."],
    responseDraft: "I can help update the phone number on your customer address.",
    missingInformation: [],
    intent: "update_contact_number",
    phone: "14692466072",
    evidence: ticket.message,
    explanation: "Update the contact number."
  };
  const execute = vi.fn(async () => ({ version: 5, phone: "14692466072" }));
  const customerByEmail = vi.fn(async (_email: string): Promise<ContactCustomer | null> => structuredClone(customer));
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
    paymentState: "Pending",
    createdAt: new Date().toISOString(),
    lineItems: [{ id: "line-1", name: "Quilt Cover", sku: "QUILT-1", quantity: 1 }],
    returnInfo: []
  };
  const findings: OrderFindings = {
    summary: "Order inquiry",
    actions: ["Confirm order status with customer"],
    responseDraft: "Your order is awaiting shipment.",
    missingInformation: []
  };
  const executeOrder = vi.fn(async (_order: ReviewOrder, action: import("./types.js").OrderAction) => {
    order.version = 5;
    return {
      id: order.id,
      version: 5,
      ...(action.kind === "start_return"
        ? { returnTrackingId: "CSA-RETURN-123" }
        : {})
    };
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
    customerByEmail,
    analyze,
    closeTicket,
    draftResolution,
    execute
  });
  return {
    requestInformation,
    customerByEmail,
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
  it("persists guidance and a response draft for every query when no action can be automated", async () => {
    const f = fixture();
    f.ticket.subject = "Return and refund questions";
    f.ticket.message = "How do I return order 1001, and when would the refund be issued?";
    Object.assign(f.analysis, {
      summary: "Customer asks how to return an order and when its refund would be issued.",
      queryAnswers: [
        {
          query: "How do I return order 1001?",
          answer: "Verify return eligibility, then start the approved Returns workflow.",
          status: "needs_verification"
        },
        {
          query: "When would the refund be issued?",
          answer: "Check the applicable refund policy before giving a timeframe.",
          status: "needs_verification"
        }
      ],
      actions: [
        "Open order 1001 and verify return eligibility.",
        "Check the applicable refund timing policy."
      ],
      responseDraft: "I can help with the return and refund timing. I’ll first verify the order’s eligibility and the applicable refund policy.",
      missingInformation: [],
      intent: "unsupported",
      phone: null,
      evidence: null,
      explanation: "Review both requests and use the suggested reply."
    });

    const review = await f.service.prepare(scope, f.ticket.id);

    expect(review.status).toBe("blocked");
    expect(review.agentAssist?.queryAnswers).toHaveLength(2);
    expect(review.agentAssist?.responseDraft).toContain("return and refund timing");
    expect(review.agentAssist?.actions).toEqual(f.analysis.actions);
    expect(f.execute).not.toHaveBeenCalled();
  });

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

  it("automatically applies a grounded phone update for one address named in the ticket", async () => {
    const f = fixture();
    f.customer.targets.push({ id: "address-2", label: "Newmarket, US", phone: "2222222222" });
    f.ticket.message = "Please update my contact details for NEWMARKET address to 14692466072";
    f.analysis.evidence = f.ticket.message;
    const completed = await f.service.prepare(scope, f.ticket.id);
    expect(completed.status).toBe("succeeded");
    expect(completed.result?.phone).toBe("14692466072");
    expect(f.execute).toHaveBeenCalledWith(expect.objectContaining({ addressId: "address-2" }));
    expect(completed.approvedBy).toBeUndefined();
    expect(completed.audit.some(event => event.event === "safe_contact_update_applied")).toBe(true);
    expect(f.closeTicket).not.toHaveBeenCalled();
    await f.service.prepare(scope, f.ticket.id, true);
    expect(f.execute).toHaveBeenCalledTimes(1);
    const closed = await f.service.decideClosure(scope, f.ticket.id, completed.revision, "approve_close", "Updated Newmarket phone number.");
    expect(closed?.status).toBe("closed");
    expect(f.closeTicket).toHaveBeenCalledTimes(1);
  });

  it.each(["duplicate", "substring", "both", "closed"])("handles named addresses without unsafe execution: %s", async condition => {
    const f = fixture();
    f.customer.targets.push({ id: "address-2", label: "Newmarket, US", phone: "2222222222" });
    f.ticket.message = "Update my Newmarket address phone to 14692466072";
    if (condition === "duplicate") f.customer.targets[0].label = "Newmarket, US";
    if (condition === "substring") f.ticket.message = "Update my Newmarketville address phone to 14692466072";
    if (condition === "both") f.ticket.message = "Update Main Street and Newmarket to 14692466072";
    if (condition === "closed") f.ticket.status = "Closed";
    f.analysis.evidence = f.ticket.message;
    const result = await f.service.prepare(scope, f.ticket.id);
    expect(result.status).toBe("blocked");
    await f.service.prepare(scope, f.ticket.id, true);
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.closeTicket).not.toHaveBeenCalled();
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
  it("automatically applies a grounded same-destination shipping correction", async () => {
    const f = orderFixture();
    const address = {
      streetName: "New Street",
      streetNumber: "12",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US"
    };
    f.ticket.subject = "Correct shipping street";
    f.ticket.message = "Please ship to 12 New Street, Austin, TX 78701, US";
    f.order.shipmentState = "Ready";
    f.order.shippingAddress = {
      ...address,
      streetName: "Old Street",
      streetNumber: "1"
    };
    Object.assign(f.findings, {
      requestedAction: "change_shipping_address",
      address
    });

    const completed = await f.service.prepare(scope, f.ticket.id);

    expect(completed.status).toBe("succeeded");
    expect(f.executeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: f.order.id }),
      { kind: "change_shipping_address", address }
    );
    expect(completed.approvedBy).toBeUndefined();
    expect(
      completed.audit.some((event) => event.event === "safe_order_action_applied")
    ).toBe(true);
  });
  it("prepares and records a return only after agent approval", async () => {
    const f = orderFixture();
    f.ticket.category = "returns_refunds";
    f.ticket.subject = "Return Quilt Cover";
    f.ticket.message =
      "I'd like to return the Quilt Cover. It doesn't suit what I need.";
    Object.assign(f.order, {
      orderState: "Complete",
      shipmentState: "Delivered",
      paymentState: "Paid"
    });
    Object.assign(f.findings, {
      requestedAction: "start_return",
      returnReason: "It doesn't suit what I need",
      returnReasonEvidence: "It doesn't suit what I need.",
      returnItems: [
        {
          lineItemId: "line-1",
          quantity: 1,
          evidence: "return the Quilt Cover"
        }
      ]
    });

    const proposal = await f.service.prepare(scope, f.ticket.id);

    expect(proposal.status).toBe("pending");
    expect(proposal.orderAction).toMatchObject({
      kind: "start_return",
      reason: "It doesn't suit what I need",
      lineItems: [{ lineItemId: "line-1", quantity: 1 }]
    });
    expect(f.executeOrder).not.toHaveBeenCalled();

    const completed = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );

    expect(f.executeOrder).toHaveBeenCalledTimes(1);
    expect(completed.orderResult?.returnTrackingId).toBe("CSA-RETURN-123");
    expect(completed.resolutionDraft).toContain("No refund");
    expect(completed.approvedBy).toBe(scope.userEmail);
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


describe("agent-approved missing-information email", () => {
  it("requests missing phone details only after approval", async () => {
    const f = fixture();
    f.ticket.message = "Please update my phone number";
    Object.assign(f.analysis, { intent: "needs_information", phone: null, evidence: null, customerQuestions: ["new_phone_number"] });
    const proposal = await f.service.prepare(scope, f.ticket.id);
    expect(proposal.status).toBe("pending");
    expect(proposal.informationQuestions).toEqual(["new_phone_number"]);
    expect(f.requestInformation).not.toHaveBeenCalled();
    const review = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );
    expect(f.requestInformation).toHaveBeenCalledWith(f.ticket, ["new_phone_number"]);
    expect(review.informationRequest?.status).toBe("accepted");
    expect(review.approvedBy).toBe(scope.userEmail);
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
    const proposal = await f.service.prepare(scope, f.ticket.id);
    const review = await f.service.decide(
      scope,
      f.ticket.id,
      proposal.revision,
      "approve"
    );
    expect(review.status).toBe("uncertain");
    expect(review.informationRequestError).toContain("could not be confirmed");
    expect(f.execute).not.toHaveBeenCalled();
  });
});

it("summarizes Zendesk tickets using the persistent native review flow", async () => {
  const f = fixture();
  f.ticket.id = "zendesk:account:1";
  f.analysis.intent = "unsupported";
  f.analysis.summary = "Customer needs help with cloud migration.";
  const review = await f.service.prepare(scope, f.ticket.id);
  expect(review.summary).toBe(f.analysis.summary);
  expect(review.action).toBeNull();
  expect(f.execute).not.toHaveBeenCalled();
  expect((await f.service.load(scope, f.ticket.id))?.summary).toBe(f.analysis.summary);
});

it("requires separate approval to resolve a Zendesk ticket after a successful action", async () => {
  const f = fixture();
  f.ticket.id = "zendesk:account:1";
  f.closeTicket.mockImplementation(async () => ({ ...f.ticket, status: "Resolved", lastModifiedAt: "2026-10-06" }));
  const proposal = await f.service.prepare(scope, f.ticket.id);
  const completed = await f.service.decide(scope, f.ticket.id, proposal.revision, "approve");
  expect(completed.status).toBe("succeeded");
  expect(f.closeTicket).not.toHaveBeenCalled();
  const resolved = await f.service.decideClosure(scope, f.ticket.id, completed.revision, "approve_close", "Updated contact details");
  expect(resolved?.status).toBe("closed");
  expect(resolved?.explanation).toContain("resolved");
  expect(f.closeTicket).toHaveBeenCalledTimes(1);
});

it("matches an unlinked Zendesk requester by email and prepares the CT change", async () => {
  const f = fixture();
  f.ticket.id = "zendesk:account:2";
  f.ticket.customerId = null;
  f.ticket.customerEmail = " Customer@Example.com ";
  const review = await f.service.prepare(scope, f.ticket.id);
  expect(f.customerByEmail).toHaveBeenCalledWith("Customer@Example.com");
  expect(review.status).toBe("pending");
  expect(review.action?.customerId).toBe(f.customer.id);
  expect(f.execute).not.toHaveBeenCalled();
  const completed = await f.service.decide(scope, f.ticket.id, review.revision, "approve");
  expect(completed.status).toBe("succeeded");
  expect(f.execute).toHaveBeenCalledWith(expect.objectContaining({ customerId: f.customer.id, phone: "14692466072" }));
  expect(f.customerByEmail).toHaveBeenCalledTimes(2);
  expect(f.closeTicket).not.toHaveBeenCalled();
});

it("automatically applies an unlinked Zendesk request naming one matched CT address", async () => {
  const f = fixture();
  f.ticket.id = "zendesk:account:2";
  f.ticket.customerId = null;
  f.customer.targets.push({ id: "newmarket", label: "Newmarket, US", phone: "1111111111" });
  f.ticket.message = "Update my Newmarket address phone to 14692466072";
  f.analysis.evidence = f.ticket.message;
  const review = await f.service.prepare(scope, f.ticket.id);
  expect(review.status).toBe("succeeded");
  expect(f.execute).toHaveBeenCalledWith(expect.objectContaining({ addressId: "newmarket", customerId: f.customer.id }));
  expect(f.closeTicket).not.toHaveBeenCalled();
});

it.each(["missing email", "no unique match", "wrong email"])("blocks unverified Zendesk customers: %s", async condition => {
  const f = fixture();
  f.ticket.id = "zendesk:account:2";
  f.ticket.customerId = null;
  if (condition === "missing email") f.ticket.customerEmail = "";
  if (condition === "no unique match") f.customerByEmail.mockResolvedValue(null);
  if (condition === "wrong email") f.customerByEmail.mockResolvedValue({ ...f.customer, email: "someone-else@example.com" });
  const review = await f.service.prepare(scope, f.ticket.id);
  expect(review.status).toBe("blocked");
  expect(review.action).toBeNull();
  expect(f.execute).not.toHaveBeenCalled();
});

it("rechecks uniqueness before applying a matched email proposal", async () => {
  const f = fixture();
  f.ticket.id = "zendesk:account:2";
  f.ticket.customerId = null;
  const review = await f.service.prepare(scope, f.ticket.id);
  f.customerByEmail.mockResolvedValue(null);
  expect((await f.service.decide(scope, f.ticket.id, review.revision, "approve")).status).toBe("stale");
  expect(f.execute).not.toHaveBeenCalled();
});

it("keeps native tickets on their explicit customer link workflow", async () => {
  const f = fixture();
  f.ticket.customerId = null;
  expect((await f.service.prepare(scope, f.ticket.id)).status).toBe("blocked");
  expect(f.customerByEmail).not.toHaveBeenCalled();
});
