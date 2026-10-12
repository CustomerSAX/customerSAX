import { expect, it } from "vitest";
import { aiStatus } from "./status.js";
import type { Review } from "./types.js";
const review = (values: Partial<Review>) => values as Review;
it("distinguishes no analysis, agent help, and approval", () => {
  expect(aiStatus(null, "Closed")).toBe("not_analyzed");
  expect(aiStatus(review({ status: "blocked" }), "Open")).toBe("agent_input_needed");
  expect(aiStatus(review({ status: "pending" }), "Open")).toBe("awaiting_approval");
});
it("only calls confirmed and closed automated actions AI resolved", () => {
  const result = { version: 2, phone: "123456789" };
  expect(aiStatus(review({ status: "succeeded", result }), "Open")).toBe("action_completed");
  expect(aiStatus(review({ status: "closed", result }), "Closed")).toBe("ai_resolved");
  expect(aiStatus(review({ status: "closed" }), "Closed")).toBe("review_completed");
  expect(aiStatus(review({ status: "closed", result }), "Open")).toBe("review_needed");
});
it("only shows waiting for customer on pending tickets with an accepted information request", () => {
  const informationRequest = { status: "accepted", recipient: "test@example.com", subject: "Details", text: "Details", createdAt: "2026-10-07" };
  expect(aiStatus(review({ status: "blocked", informationRequest }), "Pending")).toBe("waiting_for_customer");
  expect(aiStatus(review({ status: "blocked", informationRequest }), "Open")).toBe("agent_input_needed");
  expect(aiStatus(review({ status: "blocked", informationRequest: { ...informationRequest, status: "unknown" } }), "Pending")).toBe("email_needs_attention");
  expect(aiStatus(review({ status: "blocked", informationRequestError: "failed" }), "Open")).toBe("email_needs_attention");
});
it.each([ ["analyzing", "analyzing"], ["executing", "ai_working"], ["closing", "ai_working"], ["failed", "analysis_failed"], ["uncertain", "check_outcome"], ["close_uncertain", "check_outcome"], ["stale", "review_needed"]] as const)("maps %s", (status, expected) => {
  expect(aiStatus(review({ status }), "Open")).toBe(expected);
});
