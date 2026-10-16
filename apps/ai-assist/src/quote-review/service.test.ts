import { describe, expect, it, vi } from "vitest";
import { createQuoteReviewService, prepareQuoteDecision } from "./service.js";
import type { QuoteAnalysis, QuoteReview, QuoteReviewStore, QuoteSnapshot } from "./types.js";

const scope = { clientId: "tenant-a", projectKey: "project-a", userEmail: "agent@example.com" };
const money = (centAmount: number) => ({ centAmount, currencyCode: "USD", fractionDigits: 2 });

function fixture(overrides: Partial<QuoteAnalysis> = {}) {
  const records = new Map<string, QuoteReview>();
  const store: QuoteReviewStore = {
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
      if (!old || old.revision !== revision || !statuses.includes(old.status)) return null;
      const next = { ...old, ...patch, audit: [...old.audit, event] };
      records.set(id, structuredClone(next));
      return structuredClone(next);
    }
  };
  const quote: QuoteSnapshot = {
    id: "quote-1",
    key: null,
    version: 3,
    quoteRequestState: "Submitted",
    comment: "Need 20 units for our new office.",
    createdAt: "2026-10-01T00:00:00.000Z",
    lastModifiedAt: "2026-10-01T00:00:00.000Z",
    totalPrice: money(40000),
    businessUnit: { key: "acme", name: "Acme" },
    customer: { id: "customer-1", email: "buyer@example.com" },
    shippingAddress: { city: "Austin", country: "US" },
    billingAddress: null,
    lineItems: [{ id: "li-1", sku: "CHAIR", name: "Chair", quantity: 20, unitPrice: money(2000), totalPrice: money(40000) }],
    inventory: [{ sku: "CHAIR", tracked: true, entries: [{ channel: null, availableQuantity: 50 }] }]
  };
  const analysis: QuoteAnalysis = {
    summary: "Buyer requests 20 chairs.",
    recommendation: "accept",
    reason: "Request is complete and stock covers the quantity.",
    findings: ["50 chairs available"],
    missingInformation: [],
    responseDraft: "Thanks, we are preparing your quote.",
    ...overrides
  };
  const analyze = vi.fn(async () => structuredClone(analysis));
  const execute = vi.fn(async (id: string, _version: number, state: string) => {
    quote.version += 1;
    quote.quoteRequestState = state;
    return { id, version: quote.version, quoteRequestState: state };
  });
  const service = createQuoteReviewService({
    store,
    quote: async (id) => (id === quote.id ? structuredClone(quote) : null),
    analyze,
    execute
  });
  return { service, quote, analyze, execute };
}

describe("quote review service", () => {
  it("prepares an approvable accept proposal pinned to the reviewed version", async () => {
    const { service } = fixture();
    const review = await service.prepare(scope, "quote-1");
    expect(review.status).toBe("pending");
    expect(review.action).toEqual({ state: "Accepted", expectedVersion: 3 });
  });

  it("reuses the saved review unless refreshed or the quote changed", async () => {
    const { service, analyze } = fixture();
    await service.prepare(scope, "quote-1");
    await service.prepare(scope, "quote-1");
    expect(analyze).toHaveBeenCalledTimes(1);
    await service.prepare(scope, "quote-1", true);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("executes only after approval and records the confirmed state", async () => {
    const { service, execute } = fixture();
    const review = await service.prepare(scope, "quote-1");
    expect(execute).not.toHaveBeenCalled();
    const approved = await service.decide(scope, "quote-1", review.revision, "approve");
    expect(execute).toHaveBeenCalledWith("quote-1", 3, "Accepted");
    expect(approved.status).toBe("succeeded");
    expect(approved.result).toEqual({ version: 4, quoteRequestState: "Accepted" });
    // Repeat clicks never execute again.
    await service.decide(scope, "quote-1", review.revision, "approve");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("marks the proposal stale when the quote changed before approval", async () => {
    const { service, quote, execute } = fixture();
    const review = await service.prepare(scope, "quote-1");
    quote.version = 4;
    const result = await service.decide(scope, "quote-1", review.revision, "approve");
    expect(result.status).toBe("stale");
    expect(execute).not.toHaveBeenCalled();
  });

  it("reports an unconfirmed write as uncertain without retrying", async () => {
    const { service, execute } = fixture();
    execute.mockRejectedValueOnce(new Error("timeout"));
    const review = await service.prepare(scope, "quote-1");
    const result = await service.decide(scope, "quote-1", review.revision, "approve");
    expect(result.status).toBe("uncertain");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("declines without touching commercetools", async () => {
    const { service, execute } = fixture();
    const review = await service.prepare(scope, "quote-1");
    expect((await service.decide(scope, "quote-1", review.revision, "decline")).status).toBe("declined");
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not call the model for an already decided quote request", async () => {
    const { service, quote, analyze } = fixture();
    quote.quoteRequestState = "Accepted";
    const review = await service.prepare(scope, "quote-1");
    expect(review.status).toBe("blocked");
    expect(review.action).toBeNull();
    expect(analyze).not.toHaveBeenCalled();
  });

  it("keeps needs_information proposals non-executable", async () => {
    const { service } = fixture({ recommendation: "needs_information", reason: "Stock for DESK is untracked." });
    const review = await service.prepare(scope, "quote-1");
    expect(review.status).toBe("blocked");
    expect(review.action).toBeNull();
    expect(review.explanation).toBe("Stock for DESK is untracked.");
  });

  it("records an analysis failure instead of throwing", async () => {
    const { service, analyze } = fixture();
    analyze.mockRejectedValueOnce(new Error("model down"));
    expect((await service.prepare(scope, "quote-1")).status).toBe("failed");
  });
});

describe("prepareQuoteDecision", () => {
  const base = fixture().quote;
  const analysis = (recommendation: QuoteAnalysis["recommendation"]): QuoteAnalysis => ({
    summary: "s",
    recommendation,
    reason: "r",
    findings: ["f"],
    missingInformation: [],
    responseDraft: "d"
  });
  it("refuses to accept a request without line items or customer", () => {
    expect(prepareQuoteDecision({ ...base, lineItems: [] }, analysis("accept")).action).toBeUndefined();
    expect(prepareQuoteDecision({ ...base, customer: null }, analysis("accept")).action).toBeUndefined();
  });
  it("maps reject to the Rejected state", () => {
    expect(prepareQuoteDecision(base, analysis("reject")).action).toBe("Rejected");
  });
});
