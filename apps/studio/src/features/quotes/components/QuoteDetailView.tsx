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
  label: string;
};

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

function buildTimeline(quote: QuoteDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [{ label: "Quote requested", date: quote.createdAt }];

  if (quote.comment) {
    events.push({ label: `Buyer note: ${quote.comment}`, date: quote.createdAt });
  }

  events.push({ label: "Submitted to seller for review", date: quote.lastModifiedAt || quote.createdAt });

  return events;
}

export function QuoteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [actingRole, setActingRole] = useState<"buyer" | "seller">("buyer");
  const { data, loading, error } = useQuery<QuoteDetailData>(QUOTE_DETAIL_QUERY, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });

  const quote = data?.quote ?? null;
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
  const timeline = buildTimeline(quote);
  const waitingOnSeller = statusLabel(quote.status) === "Requested";
  const actionsDisabled = actingRole === "buyer" && waitingOnSeller;

  return (
    <DetailPage>
      <EntityHeader
        title={
          <span className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-m-primary">B2B Commerce</span>
            <span>{`Quote ${displayId}`}</span>
          </span>
        }
        status={<StatusPill tone={statusTone(quote.status)}>{statusLabel(quote.status)}</StatusPill>}
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
            action={<StatusPill tone={statusTone(quote.status)}>{statusLabel(quote.status)}</StatusPill>}
          >
            <p className="mb-4 text-sm text-m-text-muted">
              {waitingOnSeller ? "Awaiting seller review" : statusLabel(quote.status)}
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
                    <p className="text-xs text-m-text-muted">{formatDateTime(event.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Act on this quote">
            <p className="text-sm text-m-text-muted">
              Same console handles both sides. Pick who you are representing on this call.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["buyer", "seller"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActingRole(role)}
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

            {actionsDisabled && (
              <div className="mt-4 rounded-m-md border border-m-warning-border bg-m-warning-light px-3 py-2 text-xs font-semibold text-m-warning-dark">
                Waiting on the seller to respond. You are acting as buyer, so these are disabled.
              </div>
            )}

            <div className="mt-5 divide-y divide-m-border">
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-m-text">Approve request</p>
                  <p className="text-xs text-m-text-muted">Approve the buyer quote request</p>
                </div>
                <Button variant="primary" size="sm" disabled={actionsDisabled}>
                  Approve
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-m-text">Reject request</p>
                  <p className="text-xs text-m-text-muted">Reject this quote request</p>
                </div>
                <Button variant="danger" size="sm" disabled={actionsDisabled}>
                  Reject
                </Button>
              </div>
            </div>
          </SectionCard>
        </SideColumn>
      </ContentGrid>
    </DetailPage>
  );
}
