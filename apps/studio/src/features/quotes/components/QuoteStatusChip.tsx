import { Badge } from "@csa/ui";
import type { QuoteStatus } from "../types/quote-types";

export function QuoteStatusChip({ status, label = status }: { status: QuoteStatus | string; label?: string }) {
  switch (status) {
    case "Accepted":
    case "Approved":
    case "Converted":
      return <Badge variant="success" size="sm">{label}</Badge>;
    case "In Review":
    case "Submitted":
    case "Requested":
    case "Changes Requested":
      return <Badge variant="warning" size="sm">{label}</Badge>;
    case "Buyer Review":
    case "Seller Review":
      return <Badge variant="primary" size="sm">{label}</Badge>;
    case "Draft":
      return <Badge variant="primary" size="sm">{label}</Badge>;
    case "Rejected":
    case "Declined":
    case "Cancelled":
      return <Badge variant="error" size="sm">{label}</Badge>;
    default:
      return <Badge variant="neutral" size="sm">{label}</Badge>;
  }
}
