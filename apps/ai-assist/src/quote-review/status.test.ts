import { expect, it } from "vitest";
import { quoteAiStatus } from "./status.js";
import type { QuoteReview } from "./types.js";

const review = (patch: Partial<QuoteReview>): QuoteReview => ({
  _id: "r",
  clientId: "c",
  projectKey: "p",
  quoteId: "q",
  quoteVersion: 1,
  quoteState: "Submitted",
  quoteLastModifiedAt: "t1",
  revision: "rev",
  status: "pending",
  summary: "",
  explanation: "",
  action: null,
  updatedAt: "",
  audit: [],
  ...patch
});
const open = { status: "Submitted", lastModifiedAt: "t1" };

it("maps quote reviews to shared AI status values", () => {
  expect(quoteAiStatus(null, open)).toBe("not_analyzed");
  expect(quoteAiStatus(review({ status: "pending" }), open)).toBe("awaiting_approval");
  expect(quoteAiStatus(review({ status: "blocked" }), open)).toBe("agent_input_needed");
  expect(quoteAiStatus(review({ status: "declined" }), open)).toBe("agent_input_needed");
  expect(quoteAiStatus(review({ status: "succeeded" }), { status: "Accepted" })).toBe("action_completed");
  expect(quoteAiStatus(review({ status: "executing" }), open)).toBe("ai_working");
  expect(quoteAiStatus(review({ status: "uncertain" }), open)).toBe("check_outcome");
  expect(quoteAiStatus(review({ status: "failed" }), open)).toBe("analysis_failed");
});

it("flags proposals invalidated by later quote changes", () => {
  expect(quoteAiStatus(review({ status: "pending" }), { status: "Submitted", lastModifiedAt: "t2" })).toBe("review_needed");
  // Decided manually after the AI review: nothing left to approve.
  expect(quoteAiStatus(review({ status: "pending" }), { status: "Accepted", lastModifiedAt: "t2" })).toBe("review_completed");
});
