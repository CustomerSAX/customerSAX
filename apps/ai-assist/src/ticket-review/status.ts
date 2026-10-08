import type { Review } from "./types.js";

export function aiStatus(review: Review | null, ticketStatus: string): string {
  if (!review) return "not_analyzed";
  switch (review.status) {
    case "analyzing": return "analyzing";
    case "executing": case "closing": return "ai_working";
    case "uncertain": case "close_uncertain": return "check_outcome";
    case "failed": return "analysis_failed";
    case "stale": case "close_stale": return "review_needed";
    case "closed": return !["closed", "resolved"].includes(ticketStatus.toLowerCase()) ? "review_needed" : review.result || review.orderResult ? "ai_resolved" : "review_completed";
    case "succeeded": return review.result || review.orderResult ? "action_completed" : "review_completed";
    case "kept_open": return review.result || review.orderResult ? "action_completed" : "review_completed";
    case "declined": return "agent_input_needed";
    default:
      if (review.informationRequestError || ["rejected", "unknown", "sending"].includes(review.informationRequest?.status ?? "")) return "email_needs_attention";
      if (review.informationRequest?.status === "accepted" && ["pending", "waiting"].includes(ticketStatus.toLowerCase())) return "waiting_for_customer";
      return review.status === "pending" ? "awaiting_approval" : "agent_input_needed";
  }
}
