"use client";

import { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  Button,
  CardEmpty,
  ContentGrid,
  DetailPage,
  EntityHeader,
  InfoList,
  InfoRow,
  MainColumn,
  SectionCard,
  SideColumn,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextArea,
  type StatusTone,
} from "@csa/ui";
import { formatDateTime } from "@/lib/format-date";

const QUOTE_DETAIL_QUERY = gql`
  query QuoteDetail($id: ID!) {
    quote(id: $id) {
      id
      key
      quoteNumber
      comment
      companyKey
      companyName
      businessUnit {
        key
        name
      }
      customerId
      customerEmail
      customer {
        id
        firstName
        lastName
        email
      }
      status
      totalPrice {
        centAmount
        currencyCode
        fractionDigits
      }
      shippingAddress {
        streetNumber
        streetName
        apartment
        building
        pOBox
        city
        state
        postalCode
        country
        phone
        mobile
        additionalStreetInfo
        additionalAddressInfo
      }
      billingAddress {
        streetNumber
        streetName
        apartment
        building
        pOBox
        city
        state
        postalCode
        country
        phone
        mobile
        additionalStreetInfo
        additionalAddressInfo
      }
      lineItems {
        id
        sku
        name
        quantity
        unitPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
      createdAt
      lastModifiedAt
    }
  }
`;

type Money = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

type QuoteAddress = {
  additionalAddressInfo?: string | null;
  additionalStreetInfo?: string | null;
  apartment?: string | null;
  building?: string | null;
  city?: string | null;
  country?: string | null;
  mobile?: string | null;
  pOBox?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  state?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
};

type QuoteDetail = {
  billingAddress?: QuoteAddress | null;
  businessUnit?: { key?: string | null; name?: string | null } | null;
  comment?: string | null;
  companyKey?: string | null;
  companyName?: string | null;
  createdAt?: string | null;
  customer?: { email?: string | null; firstName?: string | null; id?: string | null; lastName?: string | null } | null;
  customerEmail?: string | null;
  customerId?: string | null;
  id: string;
  key?: string | null;
  lastModifiedAt?: string | null;
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    sku?: string | null;
    totalPrice: Money;
    unitPrice?: Money | null;
  }>;
  quoteNumber?: string | null;
  shippingAddress?: QuoteAddress | null;
  status?: string | null;
  totalPrice?: Money | null;
};

type QuoteDetailData = {
  quote: QuoteDetail | null;
};

type TimelineEvent = {
  date: string | null | undefined;
  details?: Array<{ label: string; value: string }>;
  label: string;
};

type BuyerReviewState = "pending" | "approved" | "changes-requested" | "declined";
type BuyerWorkflowSnapshot = {
  actingRole?: "buyer" | "seller";
  buyerReviewState?: BuyerReviewState;
  buyerReviewUpdatedAt?: string | null;
  buyerNegotiationNote?: string | null;
};

type BuyerWorkflowState = {
  actingRole: "buyer" | "seller";
  buyerReviewState: BuyerReviewState;
  buyerReviewUpdatedAt: string | null;
  buyerNegotiationNote: string;
};

function workflowStorageKey(id: string) {
  return `csa_quote_review_${id}`;
}

function readWorkflowState(id: string): BuyerWorkflowState {
  const fallback: BuyerWorkflowState = {
    actingRole: "buyer",
    buyerReviewState: "pending",
    buyerReviewUpdatedAt: null,
    buyerNegotiationNote: ""
  };

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(workflowStorageKey(id));
    if (!stored) return fallback;

    const parsed = JSON.parse(stored) as BuyerWorkflowSnapshot;

    return {
      actingRole: parsed.actingRole || fallback.actingRole,
      buyerReviewState: parsed.buyerReviewState || fallback.buyerReviewState,
      buyerReviewUpdatedAt: parsed.buyerReviewUpdatedAt || fallback.buyerReviewUpdatedAt,
      buyerNegotiationNote: parsed.buyerNegotiationNote || fallback.buyerNegotiationNote
    };
  } catch {
    return fallback;
  }
}

function formatQuoteComment(comment: string): Pick<TimelineEvent, "details" | "label"> {
  const lines = comment
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const detailRows: Array<{ label: string; value: string }> = [];
  const notes: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match && ["Valid until", "Requested discount", "Negotiated total shown in Studio"].includes(match[1])) {
      detailRows.push({ label: match[1], value: match[2] });
    } else if (match?.[1] === "Buyer note") {
      notes.push(match[2]);
    } else if (!line.startsWith("Line-level negotiated prices")) {
      notes.push(line);
    }
  }

  return {
    label: notes.length > 0 ? `Buyer note: ${notes.join(" ")}` : "Buyer note",
    details: detailRows.length > 0 ? detailRows : undefined
  };
}

function formatMoney(money?: Money | null) {
  if (!money) return "--";
  const amount = money.centAmount / 10 ** (money.fractionDigits ?? 2);

  return `${money.currencyCode} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function moneyAmount(money?: Money | null) {
  if (!money) return 0;
  return money.centAmount / 10 ** (money.fractionDigits ?? 2);
}

function formatAmount(amount: number, currencyCode: string) {
  return `${currencyCode} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusTone(status?: string | null): StatusTone {
  switch (status) {
    case "Accepted":
    case "Approved":
    case "Converted":
      return "success";
    case "Rejected":
    case "Declined":
    case "Cancelled":
      return "error";
    case "Submitted":
    case "InProgress":
    case "In Review":
    case "Buyer Approved":
    case "Changes Requested":
    case "Seller Review":
      return "info";
    default:
      return "neutral";
  }
}

function statusLabel(status?: string | null) {
  if (!status) return "Requested";
  if (status === "Submitted") return "Requested";
  if (status === "InProgress") return "Draft";
  return status;
}

function workflowStatusLabel(status: string, buyerReviewState: BuyerReviewState) {
  if (status !== "Requested") return status;

  switch (buyerReviewState) {
    case "approved":
      return "Seller Review";
    case "changes-requested":
      return "Changes Requested";
    case "declined":
      return "Declined";
    default:
      return status;
  }
}

function addressLines(address?: QuoteAddress | null) {
  if (!address) return ["--"];

  const lines = [
    [address.streetNumber, address.streetName].filter(Boolean).join(" "),
    address.apartment || address.building || address.pOBox,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
    address.phone || address.mobile,
    address.additionalStreetInfo,
    address.additionalAddressInfo,
  ].filter((line): line is string => Boolean(line && line.trim()));

  return lines.length > 0 ? lines : ["--"];
}

function customerName(quote: QuoteDetail) {
  const fullName = [quote.customer?.firstName, quote.customer?.lastName].filter(Boolean).join(" ").trim();
  return fullName || quote.customerEmail || quote.customer?.email || quote.customerId || "--";
}

function buildTimeline(
  quote: QuoteDetail,
  buyerReviewState: BuyerReviewState,
  buyerReviewUpdatedAt?: string | null,
  buyerNegotiationNote?: string | null
): TimelineEvent[] {
  const events: TimelineEvent[] = [{ label: "Quote requested", date: quote.createdAt }];

  if (quote.comment) {
    const comment = formatQuoteComment(quote.comment);
    events.push({ ...comment, date: quote.createdAt });
  }

  events.push({ label: "Submitted to seller for review", date: quote.lastModifiedAt || quote.createdAt });

  if (buyerReviewState === "approved") {
    events.push({ label: "Buyer approved quote", date: buyerReviewUpdatedAt });
  }

  if (buyerReviewState === "changes-requested") {
    events.push({
      label: "Buyer requested changes",
      date: buyerReviewUpdatedAt,
      details: buyerNegotiationNote ? [{ label: "Request", value: buyerNegotiationNote }] : undefined
    });
  }

  if (buyerReviewState === "declined") {
    events.push({ label: "Buyer declined quote", date: buyerReviewUpdatedAt });
  }

  return events;
}

export function QuoteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<BuyerWorkflowState>(() => readWorkflowState(id));
  const [actionFeedback, setActionFeedback] = useState("");
  const [actionLoading, setActionLoading] = useState<"Accepted" | "Rejected" | null>(null);
  const [negotiatingAs, setNegotiatingAs] = useState<"buyer" | "seller" | null>(null);
  const [negotiationNote, setNegotiationNote] = useState("");
  const { data, loading, error, refetch } = useQuery<QuoteDetailData>(QUOTE_DETAIL_QUERY, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });

  const quote = data?.quote ?? null;
  const { actingRole, buyerNegotiationNote, buyerReviewState, buyerReviewUpdatedAt } = workflow;

  const persistWorkflow = (next: BuyerWorkflowSnapshot) => {
    const payload: BuyerWorkflowState = {
      actingRole: next.actingRole || workflow.actingRole,
      buyerReviewState: next.buyerReviewState || workflow.buyerReviewState,
      buyerReviewUpdatedAt:
        next.buyerReviewUpdatedAt === undefined ? workflow.buyerReviewUpdatedAt : next.buyerReviewUpdatedAt,
      buyerNegotiationNote:
        next.buyerNegotiationNote === undefined ? workflow.buyerNegotiationNote : next.buyerNegotiationNote || ""
    };
    setWorkflow(payload);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(workflowStorageKey(id), JSON.stringify(payload));
    }
  };
  const totals = useMemo(() => {
    if (!quote) return { currencyCode: "USD", subtotal: 0, total: 0 };
    const subtotal = quote.lineItems.reduce((sum, item) => sum + moneyAmount(item.totalPrice), 0);
    return {
      currencyCode: quote.totalPrice?.currencyCode || quote.lineItems[0]?.totalPrice.currencyCode || "USD",
      subtotal,
      total: moneyAmount(quote.totalPrice) || subtotal,
    };
  }, [quote]);

  if (loading && !quote) {
    return (
      <DetailPage>
        <SectionCard title="Loading quote" icon="file-text">
          <p className="text-sm text-m-text-muted">Fetching quote details from the commerce backend.</p>
        </SectionCard>
      </DetailPage>
    );
  }

  if (error || !quote) {
    return (
      <DetailPage>
        <EntityHeader
          title="Quote not found"
          meta={error?.message || `No quote request matched ${id}.`}
          actions={
            <Button variant="secondary" onClick={() => router.back()}>
              Back
            </Button>
          }
        />
      </DetailPage>
    );
  }

  const company = quote.businessUnit?.name || quote.companyName || quote.businessUnit?.key || quote.companyKey || "--";
  const displayId = quote.quoteNumber || quote.key || `#${quote.id.slice(0, 8)}`;
  const requestedAt = formatDateTime(quote.createdAt);
  const lineItemCount = quote.lineItems.length;
  const backendStatus = statusLabel(quote.status);
  const displayStatus = workflowStatusLabel(backendStatus, buyerReviewState);
  const timeline = buildTimeline(quote, buyerReviewState, buyerReviewUpdatedAt, buyerNegotiationNote);
  const waitingOnSeller = backendStatus === "Requested";
  const terminalStatus = ["Accepted", "Approved", "Rejected", "Declined", "Cancelled", "Converted"].includes(
    displayStatus
  );
  const buyerCanAct = actingRole === "buyer" && waitingOnSeller && buyerReviewState === "pending" && !terminalStatus;
  const sellerCanAct =
    actingRole === "seller" &&
    waitingOnSeller &&
    ["approved", "changes-requested"].includes(buyerReviewState) &&
    !terminalStatus &&
    !actionLoading;

  const approveBuyerReview = () => {
    const reviewedAt = new Date().toISOString();
    setNegotiatingAs(null);
    setNegotiationNote("");
    setActionFeedback("Buyer approved the quote. Seller can now respond.");
    persistWorkflow({
      actingRole: "seller",
      buyerReviewState: "approved",
      buyerReviewUpdatedAt: reviewedAt,
      buyerNegotiationNote: ""
    });
  };

  const declineBuyerReview = () => {
    const reviewedAt = new Date().toISOString();
    setNegotiatingAs(null);
    setNegotiationNote("");
    setActionFeedback("Buyer declined the quote in Studio.");
    persistWorkflow({
      actingRole: "buyer",
      buyerReviewState: "declined",
      buyerReviewUpdatedAt: reviewedAt,
      buyerNegotiationNote: ""
    });
  };

  const startNegotiation = (role: "buyer" | "seller") => {
    setNegotiatingAs(role);
    setNegotiationNote("");
    setActionFeedback("");
  };

  const cancelNegotiation = () => {
    setNegotiatingAs(null);
    setNegotiationNote("");
  };

  const sendNegotiation = () => {
    const note = negotiationNote.trim();
    if (!note) return;

    if (negotiatingAs === "buyer") {
      const reviewedAt = new Date().toISOString();
      setActionFeedback("Buyer change request was sent to seller.");
      persistWorkflow({
        actingRole: "seller",
        buyerReviewState: "changes-requested",
        buyerReviewUpdatedAt: reviewedAt,
        buyerNegotiationNote: note
      });
    } else {
      setActionFeedback("Seller negotiation note was recorded in Studio.");
    }
    setNegotiatingAs(null);
    setNegotiationNote("");
  };

  const updateQuoteRequestState = async (state: "Accepted" | "Rejected") => {
    if (!sellerCanAct) return;

    setActionLoading(state);
    setActionFeedback("");

    try {
      const response = await fetch(`/api/quotes/requests/${encodeURIComponent(quote.id)}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update quote request.");
      }

      await refetch();
      setActionFeedback(state === "Accepted" ? "Seller accepted the quote request." : "Seller rejected the quote request.");
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : "Unable to update quote request.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DetailPage>
      <EntityHeader
        title={
          <span className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-m-primary">B2B Commerce</span>
            <span>{`Quote ${displayId}`}</span>
          </span>
        }
        status={<StatusPill tone={statusTone(displayStatus)}>{displayStatus}</StatusPill>}
        meta={`${company} • ${quote.customerEmail || quote.customer?.email || "--"} • Requested ${requestedAt}`}
        actions={
          <Button variant="secondary" onClick={() => router.back()}>
            Back
          </Button>
        }
      />

      <ContentGrid>
        <MainColumn>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Business unit">
              <InfoList>
                <InfoRow label="Name" value={company} />
                <InfoRow label="Business unit ID" value={quote.businessUnit?.key || quote.companyKey || "--"} mono />
                <InfoRow label="Industry" value="--" />
                <InfoRow label="Account tier" value="--" />
              </InfoList>
            </SectionCard>

            <SectionCard title="Customer">
              <InfoList>
                <InfoRow label="Name" value={customerName(quote)} />
                <InfoRow label="Email" value={quote.customerEmail || quote.customer?.email || "--"} />
                <InfoRow label="Role" value="Admin" />
                <InfoRow label="Phone" value={quote.shippingAddress?.phone || quote.billingAddress?.phone || "--"} />
              </InfoList>
            </SectionCard>

            <SectionCard title="Billing address">
              <div className="space-y-1 text-sm text-m-text">
                {addressLines(quote.billingAddress || quote.shippingAddress).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Shipping address">
              <div className="space-y-1 text-sm text-m-text">
                {addressLines(quote.shippingAddress).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Line items" icon="columns-3" bodyClassName="p-0">
            {lineItemCount === 0 ? (
              <CardEmpty icon="shopping-bag" title="No line items" />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.sku || "--"}</TableCell>
                        <TableCell className="font-semibold text-m-text">{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                        <TableCell className="font-semibold">{formatMoney(item.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="space-y-2 border-t border-m-border p-4 text-sm">
                  <div className="flex justify-between text-m-text-muted">
                    <span>Subtotal</span>
                    <span>{formatAmount(totals.subtotal, totals.currencyCode)}</span>
                  </div>
                  <div className="flex justify-between text-m-text-muted">
                    <span>Line discounts</span>
                    <span>--</span>
                  </div>
                  <div className="flex justify-between border-t border-m-border pt-2 text-base font-bold text-m-text">
                    <span>Total</span>
                    <span>{formatAmount(totals.total, totals.currencyCode)}</span>
                  </div>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title={`Credit position - ${company}`}>
            <InfoList>
              <InfoRow label="Credit limit" value="--" />
              <InfoRow label="Currently used" value="--" />
              <InfoRow label="After this quote" value="--" />
              <InfoRow label="Over limit by" value="--" />
            </InfoList>
          </SectionCard>
        </MainColumn>

        <SideColumn>
          <SectionCard
            title="Quote status"
            action={<StatusPill tone={statusTone(displayStatus)}>{displayStatus}</StatusPill>}
          >
            <p className="mb-4 text-sm text-m-text-muted">
              {displayStatus === "Requested"
                ? "Awaiting buyer review"
                : displayStatus === "Seller Review"
                  ? "Awaiting seller review"
                  : displayStatus === "Changes Requested"
                    ? "Changes requested by buyer"
                    : displayStatus}
            </p>
            <div className="space-y-3">
              {timeline.map((event, index) => (
                <div
                  key={`${event.label}-${index}`}
                  className="flex gap-3 border-t border-m-border/70 pt-3 first:border-t-0 first:pt-0"
                >
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-m-neutral-300" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-m-text">{event.label}</p>
                    {event.details && (
                      <dl className="mt-2 grid gap-1.5 rounded-m-md border border-m-border bg-m-surface-2 px-3 py-2 text-xs">
                        {event.details.map((detail) => (
                          <div key={detail.label} className="flex items-center justify-between gap-3">
                            <dt className="text-m-text-muted">{detail.label}</dt>
                            <dd className="font-semibold text-m-text">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <p className="text-xs text-m-text-muted">{formatDateTime(event.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Act on this quote">
            <p className="text-sm text-m-text-muted">
              Same console handles both sides - pick who you&apos;re representing on this call. It picks up wherever the quote was left.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["buyer", "seller"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => persistWorkflow({ actingRole: role })}
                  className={`rounded-m-lg border px-3 py-3 text-left transition-colors ${
                    actingRole === role
                      ? "border-m-primary-300 bg-m-primary-50"
                      : "border-m-border bg-m-surface hover:bg-m-surface-2"
                  }`}
                >
                  <span className="block text-sm font-bold capitalize text-m-text">{role}</span>
                  <span className="mt-1 block truncate text-xs text-m-text-muted">
                    {role === "buyer" ? customerName(quote) : "Sales rep"}
                  </span>
                </button>
              ))}
            </div>

            {actingRole === "buyer" && waitingOnSeller && (
              <div className="mt-4 rounded-m-md border border-m-info-border bg-m-info-light px-3 py-2 text-xs font-semibold text-m-info">
                {buyerReviewState === "pending"
                  ? "Buyer review is required before the seller can respond."
                  : buyerReviewState === "approved"
                    ? "Buyer approved the quote. Seller can respond next."
                    : buyerReviewState === "changes-requested"
                      ? "Buyer requested changes. Seller can respond next."
                      : "Buyer declined the quote in Studio."}
              </div>
            )}

            {actingRole === "seller" && (
              <div className="mt-4 rounded-m-md border border-m-border bg-m-surface-2 px-3 py-2 text-xs font-semibold text-m-text-muted">
                {terminalStatus
                  ? `This quote is ${displayStatus}. No further review action is available.`
                  : buyerReviewState === "pending"
                    ? "Waiting for buyer approval before seller response."
                    : "Review the buyer request, then accept it to continue quote preparation, reject it, or negotiate changes."}
              </div>
            )}

            {actionFeedback && (
              <div className={`mt-4 rounded-m-md border px-3 py-2 text-xs font-semibold ${
                actionFeedback.toLowerCase().includes("unable") || actionFeedback.toLowerCase().includes("error")
                  ? "border-m-error-border bg-m-error-light text-m-error"
                  : "border-m-success-border bg-m-success-light text-m-success"
              }`}>
                {actionFeedback}
              </div>
            )}

            <div className="mt-5 divide-y divide-m-border">
              {actingRole === "buyer" ? (
                <>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-m-text">Approve</p>
                      <p className="text-xs text-m-text-muted">Approve the quote as it stands</p>
                    </div>
                    <Button variant="primary" size="sm" disabled={!buyerCanAct} onClick={approveBuyerReview}>
                      Approve
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-m-text">Decline</p>
                      <p className="text-xs text-m-text-muted">Decline this quote</p>
                    </div>
                    <Button variant="outline" size="sm" disabled={!buyerCanAct} onClick={declineBuyerReview}>
                      Decline
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-m-text">Negotiate / request changes</p>
                      <p className="text-xs text-m-text-muted">Send the quote back to the seller</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!buyerCanAct && negotiatingAs !== "buyer"}
                      onClick={() => negotiatingAs === "buyer" ? cancelNegotiation() : startNegotiation("buyer")}
                    >
                      {negotiatingAs === "buyer" ? "Cancel" : "Negotiate"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-m-text">Accept request</p>
                      <p className="text-xs text-m-text-muted">Seller accepts the buyer quote request</p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!sellerCanAct}
                      onClick={() => updateQuoteRequestState("Accepted")}
                    >
                      {actionLoading === "Accepted" ? "Accepting..." : "Accept"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-m-text">Reject request</p>
                      <p className="text-xs text-m-text-muted">Reject this quote request</p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!sellerCanAct}
                      onClick={() => updateQuoteRequestState("Rejected")}
                    >
                      {actionLoading === "Rejected" ? "Rejecting..." : "Reject"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-m-text">Negotiate / request changes</p>
                      <p className="text-xs text-m-text-muted">Send changes back to the buyer</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!sellerCanAct && negotiatingAs !== "seller"}
                      onClick={() => negotiatingAs === "seller" ? cancelNegotiation() : startNegotiation("seller")}
                    >
                      {negotiatingAs === "seller" ? "Cancel" : "Negotiate"}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {negotiatingAs && (
              <div className="mt-4 space-y-3 border-t border-m-border pt-4">
                <TextArea
                  value={negotiationNote}
                  onChange={(event) => setNegotiationNote(event.target.value)}
                  placeholder="What should change? (shared with the other side)"
                  resize="vertical"
                />
                <div className="flex justify-start">
                  <Button variant="primary" size="sm" disabled={!negotiationNote.trim()} onClick={sendNegotiation}>
                    {negotiatingAs === "buyer" ? "Send to seller" : "Send to buyer"}
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </SideColumn>
      </ContentGrid>
    </DetailPage>
  );
}
