import type { QuoteReview } from "./types.js";

/** Maps a saved review plus the quote's current list state to the shared AI status badge values. */
export function quoteAiStatus(
  review: QuoteReview | null,
  quote: { status: string; lastModifiedAt?: string | null }
): string {
  if (!review) return "not_analyzed";
  switch (review.status) {
    case "analyzing": return "analyzing";
    case "executing": return "ai_working";
    case "uncertain": return "check_outcome";
    case "failed": return "analysis_failed";
    case "stale": return "review_needed";
    case "succeeded": return "action_completed";
    default:
      // Decided outside this review (manual Accept/Reject, buyer cancel): nothing left to approve.
      if (quote.status !== "Submitted") return "review_completed";
      if (quote.lastModifiedAt && review.quoteLastModifiedAt && quote.lastModifiedAt !== review.quoteLastModifiedAt)
        return "review_needed";
      return review.status === "pending" ? "awaiting_approval" : "agent_input_needed";
  }
}
