import { Badge } from "@csa/ui";
import type { QuoteStatus } from "../types/quote-types";

export function QuoteStatusChip({ status }: { status: QuoteStatus | string }) {
  switch (status) {
    case "Approved":
    case "Converted":
      return <Badge variant="success" size="sm">{status}</Badge>;
    case "In Review":
    case "Submitted":
      return <Badge variant="warning" size="sm">{status}</Badge>;
    case "Draft":
      return <Badge variant="primary" size="sm">{status}</Badge>;
    case "Declined":
    case "Cancelled":
      return <Badge variant="error" size="sm">{status}</Badge>;
    default:
      return <Badge variant="neutral" size="sm">{status}</Badge>;
  }
}
