import { createHash, randomUUID } from "node:crypto";
import { ReviewError } from "../ticket-review/service.js";
import type {
  QuoteAnalysis,
  QuoteDecision,
  QuoteReview,
  QuoteReviewStore,
  QuoteSnapshot,
  Scope
} from "./types.js";

type Dependencies = {
  store: QuoteReviewStore;
  quote(id: string): Promise<QuoteSnapshot | null>;
  analyze(quote: QuoteSnapshot): Promise<QuoteAnalysis>;
  execute(
    id: string,
    expectedVersion: number,
    state: QuoteDecision
  ): Promise<{ id: string; version: number; quoteRequestState?: string | null }>;
};

const now = () => new Date().toISOString();
export const quoteReviewId = (scope: Scope, quoteId: string) =>
  createHash("sha256")
    .update(JSON.stringify(["quote", scope.clientId, scope.projectKey, quoteId]))
    .digest("hex");

/** The AI may only recommend; these checks decide whether a recommendation becomes an approvable action. */
export function prepareQuoteDecision(
  quote: QuoteSnapshot,
  analysis: QuoteAnalysis
): { action?: QuoteDecision; reason?: string } {
  if (analysis.recommendation === "needs_information") return {};
  if (quote.quoteRequestState !== "Submitted")
    return { reason: `This quote request is already ${quote.quoteRequestState ?? "decided"}.` };
  if (analysis.recommendation === "accept") {
    if (!quote.customer?.id || !quote.lineItems.length)
      return {
        reason:
          "Accepting requires a quote request with a customer and at least one line item. Handle this request manually."
      };
    return { action: "Accepted" };
  }
  if (!analysis.reason.trim())
    return { reason: "A rejection needs a stated reason. Review the request manually." };
  return { action: "Rejected" };
}

export function createQuoteReviewService(deps: Dependencies) {
  async function change(
    review: QuoteReview,
    scope: Scope,
    patch: Partial<QuoteReview>,
    event: string
  ) {
    const updatedAt = now();
    return deps.store.change(
      review._id,
      review.revision,
      [review.status],
      { ...patch, updatedAt },
      {
        at: updatedAt,
        actor: scope.userEmail,
        event,
        revision: patch.revision ?? review.revision,
        ...(patch.action !== undefined ? { action: patch.action } : {})
      }
    );
  }

  async function load(scope: Scope, quoteId: string) {
    const review = await deps.store.get(quoteReviewId(scope, quoteId));
    if (
      review &&
      ["analyzing", "executing"].includes(review.status) &&
      Date.now() - Date.parse(review.updatedAt) > 120000
    ) {
      return (
        (await change(
          review,
          scope,
          review.status === "executing"
            ? {
                status: "uncertain",
                explanation:
                  "Confirmation of the quote decision was interrupted. Check the quote request status before taking further action; this proposal will not run again."
              }
            : { status: "failed", explanation: "Analysis was interrupted. Try analyzing the quote again." },
          "interrupted"
        )) ?? review
      );
    }
    return review;
  }

  async function prepare(scope: Scope, quoteId: string, refresh = false): Promise<QuoteReview> {
    const quote = await deps.quote(quoteId);
    if (!quote) throw new ReviewError("Quote request not found.", 404);
    const previous = await load(scope, quoteId);
    if (
      previous &&
      (previous.result ||
        ["analyzing", "executing", "uncertain"].includes(previous.status) ||
        (previous.quoteVersion === quote.version && !refresh))
    )
      return previous;

    const started: QuoteReview = {
      _id: quoteReviewId(scope, quoteId),
      clientId: scope.clientId,
      projectKey: scope.projectKey,
      quoteId,
      quoteVersion: quote.version,
      quoteState: quote.quoteRequestState,
      quoteLastModifiedAt: quote.lastModifiedAt,
      revision: randomUUID(),
      status: "analyzing",
      summary: "",
      explanation: "Reading the quote request and preparing a proposal…",
      action: null,
      updatedAt: now(),
      audit: []
    };
    if (previous) {
      const patch: Partial<QuoteReview> = {
        ...started,
        analysis: undefined,
        approvedBy: undefined,
        approvedAt: undefined,
        result: undefined
      };
      delete patch._id;
      delete patch.audit;
      if (!(await change(previous, scope, patch, "analysis_started")))
        return (await load(scope, quoteId))!;
    } else if (
      !(await deps.store.insert({
        ...started,
        audit: [{ at: now(), actor: scope.userEmail, event: "analysis_started", revision: started.revision }]
      }))
    ) {
      return (await load(scope, quoteId))!;
    }

    // A decided request needs no recommendation; skip the model call entirely.
    if (quote.quoteRequestState !== "Submitted")
      return (await change(
        started,
        scope,
        {
          status: "blocked",
          summary: quote.comment?.trim() || "Quote request without a buyer comment.",
          explanation: `This quote request is already ${quote.quoteRequestState ?? "decided"}. No decision is needed.`
        },
        "already_decided"
      ))!;

    try {
      const analysis = await deps.analyze(quote);
      const decision = prepareQuoteDecision(quote, analysis);
      return (await change(
        started,
        scope,
        {
          status: decision.action ? "pending" : "blocked",
          summary: analysis.summary,
          analysis,
          action: decision.action ? { state: decision.action, expectedVersion: quote.version } : null,
          explanation:
            decision.reason ??
            (decision.action === "Accepted"
              ? "On approval, change this quote request from Submitted to Accepted in commercetools. Accepting commits to preparing a quote; no prices or discounts are set and no message is sent to the buyer."
              : decision.action === "Rejected"
                ? "On approval, change this quote request from Submitted to Rejected in commercetools. No message is sent to the buyer."
                : analysis.reason)
        },
        "proposal_prepared"
      ))!;
    } catch {
      return (await change(
        started,
        scope,
        {
          status: "failed",
          explanation:
            "Could not prepare the proposal. Check AI Assist, the commerce service, and their configuration, then try again."
        },
        "analysis_failed"
      ))!;
    }
  }

  async function decide(
    scope: Scope,
    quoteId: string,
    revision: string,
    decision: "approve" | "decline"
  ) {
    const review = await load(scope, quoteId);
    if (!review || review.revision !== revision)
      throw new ReviewError("This proposal changed. Reload it before approving.");
    if (review.status !== "pending") return review; // repeat clicks never execute again
    if (decision === "decline")
      return (
        (await change(
          review,
          scope,
          { status: "declined", explanation: "Proposal declined. The quote request was not changed." },
          "declined"
        )) ?? (await load(scope, quoteId))!
      );
    if (!review.action) throw new ReviewError("There is no executable action.");

    const quote = await deps.quote(quoteId);
    if (
      !quote ||
      quote.version !== review.action.expectedVersion ||
      quote.quoteRequestState !== "Submitted"
    )
      return (await change(
        review,
        scope,
        {
          status: "stale",
          explanation: "The quote request changed since this proposal was prepared. Analyze again before approving."
        },
        "stale"
      ))!;

    const executing = await change(
      review,
      scope,
      {
        status: "executing",
        approvedBy: scope.userEmail,
        approvedAt: now(),
        explanation: `Approved. Changing the quote request to ${review.action.state}…`
      },
      "approved"
    );
    if (!executing) return (await load(scope, quoteId))!;
    try {
      const result = await deps.execute(quoteId, review.action.expectedVersion, review.action.state);
      if (
        result.id !== quoteId ||
        result.quoteRequestState !== review.action.state ||
        result.version <= review.action.expectedVersion
      )
        throw new Error("Unconfirmed quote decision");
      return (await change(
        executing,
        scope,
        {
          status: "succeeded",
          result: { version: result.version, quoteRequestState: result.quoteRequestState },
          explanation: `Commercetools confirmed the quote request is now ${result.quoteRequestState}. Send any buyer response separately.`
        },
        "execution_succeeded"
      ))!;
    } catch {
      // A timeout may occur after CT committed. Never automatically repeat a write.
      return (await change(
        executing,
        scope,
        {
          status: "uncertain",
          explanation:
            "Commercetools did not confirm the outcome. Check the quote request status before taking further action. This proposal will not run again."
        },
        "execution_unconfirmed"
      ))!;
    }
  }

  return { load, prepare, decide };
}
