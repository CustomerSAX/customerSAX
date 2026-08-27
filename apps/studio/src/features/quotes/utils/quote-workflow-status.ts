export type QuoteWorkflowReviewState =
  | "pending"
  | "approved"
  | "changes-requested"
  | "seller-changes-requested"
  | "declined";

type QuoteWorkflowSnapshot = {
  buyerReviewState?: QuoteWorkflowReviewState;
};

export function workflowStorageKey(id: string) {
  return `csa_quote_review_${id}`;
}

export function baseQuoteStatusLabel(status?: string | null) {
  if (!status) return "Requested";
  if (status === "Submitted") return "Requested";
  if (status === "InProgress") return "Draft";
  return status;
}

export function workflowStatusLabel(
  status: string,
  buyerReviewState?: QuoteWorkflowReviewState
) {
  if (status !== "Requested") return status;

  switch (buyerReviewState) {
    case "approved":
      return "Seller Review";
    case "changes-requested":
      return "Changes Requested";
    case "seller-changes-requested":
      return "Buyer Review";
    case "declined":
      return "Declined";
    default:
      return status;
  }
}

export function readQuoteWorkflowReviewState(id: string) {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(workflowStorageKey(id));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as QuoteWorkflowSnapshot;
    return parsed.buyerReviewState;
  } catch {
    return undefined;
  }
}
