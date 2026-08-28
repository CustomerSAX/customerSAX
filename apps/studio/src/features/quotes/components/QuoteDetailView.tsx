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
  Input,
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
import {
  baseQuoteStatusLabel,
  workflowStatusLabel,
  workflowStorageKey,
  type QuoteWorkflowReviewState,
} from "../utils/quote-workflow-status";

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

type BuyerReviewState = QuoteWorkflowReviewState;
type BuyerWorkflowSnapshot = {
  actingRole?: "buyer" | "seller";
  buyerDeclineNote?: string | null;
  buyerReviewState?: BuyerReviewState;
  buyerReviewUpdatedAt?: string | null;
  buyerNegotiationNote?: string | null;
  convertedAt?: string | null;
  convertedOrderId?: string | null;
  convertedOrderNumber?: string | null;
  requestedDiscount?: string | null;
  requestedLineItems?: NegotiationLineItem[] | null;
  sellerNegotiationNote?: string | null;
  sellerReviewUpdatedAt?: string | null;
  sourceCartId?: string | null;
};

type BuyerWorkflowState = {
  actingRole: "buyer" | "seller";
  buyerDeclineNote: string;
  buyerReviewState: BuyerReviewState;
  buyerReviewUpdatedAt: string | null;
  buyerNegotiationNote: string;
  convertedAt: string | null;
  convertedOrderId: string;
  convertedOrderNumber: string;
  requestedDiscount: string;
  requestedLineItems: NegotiationLineItem[];
  sellerNegotiationNote: string;
  sellerReviewUpdatedAt: string | null;
  sourceCartId: string;
};

type NegotiationLineItem = {
  id: string;
  name: string;
  quantity: string;
  sku: string;
  unitPrice: string;
};

function readWorkflowState(id: string): BuyerWorkflowState {
  const fallback: BuyerWorkflowState = {
    actingRole: "buyer",
    buyerDeclineNote: "",
    buyerReviewState: "pending",
    buyerReviewUpdatedAt: null,
    buyerNegotiationNote: "",
    convertedAt: null,
    convertedOrderId: "",
    convertedOrderNumber: "",
    requestedDiscount: "",
    requestedLineItems: [],
    sellerNegotiationNote: "",
    sellerReviewUpdatedAt: null,
    sourceCartId: ""
  };

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(workflowStorageKey(id));
    if (!stored) return fallback;

    const parsed = JSON.parse(stored) as BuyerWorkflowSnapshot;

    return {
      actingRole: parsed.actingRole || fallback.actingRole,
      buyerDeclineNote: parsed.buyerDeclineNote || fallback.buyerDeclineNote,
      buyerReviewState: parsed.buyerReviewState || fallback.buyerReviewState,
      buyerReviewUpdatedAt: parsed.buyerReviewUpdatedAt || fallback.buyerReviewUpdatedAt,
      buyerNegotiationNote: parsed.buyerNegotiationNote || fallback.buyerNegotiationNote,
      convertedAt: parsed.convertedAt || fallback.convertedAt,
      convertedOrderId: parsed.convertedOrderId || fallback.convertedOrderId,
      convertedOrderNumber: parsed.convertedOrderNumber || fallback.convertedOrderNumber,
      requestedDiscount: parsed.requestedDiscount || fallback.requestedDiscount,
      requestedLineItems: parsed.requestedLineItems || fallback.requestedLineItems,
      sellerNegotiationNote: parsed.sellerNegotiationNote || fallback.sellerNegotiationNote,
      sellerReviewUpdatedAt: parsed.sellerReviewUpdatedAt || fallback.sellerReviewUpdatedAt,
      sourceCartId: parsed.sourceCartId || fallback.sourceCartId
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

function requestedDiscountFromComment(comment?: string | null) {
  const match = comment?.match(/^Requested discount:\s*(\d+(?:\.\d+)?)%/m);
  return match ? match[1] : "0";
}

function moneyAmount(money?: Money | null) {
  if (!money) return 0;
  return money.centAmount / 10 ** (money.fractionDigits ?? 2);
}

function inputAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
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
    case "Buyer Review":
    case "Seller Review":
      return "info";
    default:
      return "neutral";
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
  buyerNegotiationNote?: string | null,
  buyerDeclineNote?: string | null,
  sellerNegotiationNote?: string | null,
  sellerReviewUpdatedAt?: string | null,
  convertedAt?: string | null,
  convertedOrderId?: string | null,
  convertedOrderNumber?: string | null
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
    events.push({
      label: "Buyer declined quote",
      date: buyerReviewUpdatedAt,
      details: buyerDeclineNote ? [{ label: "Reason", value: buyerDeclineNote }] : undefined
    });
  }

  if (sellerNegotiationNote) {
    events.push({
      label: "Seller requested changes",
      date: sellerReviewUpdatedAt,
      details: [{ label: "Request", value: sellerNegotiationNote }]
    });
  }

  if (convertedOrderId) {
    events.push({
      label: "Converted to order",
      date: convertedAt || quote.lastModifiedAt || quote.createdAt,
      details: [{ label: "Order", value: convertedOrderNumber || convertedOrderId }]
    });
  }

  return events;
}

export function QuoteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<BuyerWorkflowState>(() => readWorkflowState(id));
  const [actionFeedback, setActionFeedback] = useState("");
  const [actionLoading, setActionLoading] = useState<"Accepted" | "Rejected" | "Converted" | null>(null);
  const [isDecliningBuyerReview, setIsDecliningBuyerReview] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [negotiatingAs, setNegotiatingAs] = useState<"buyer" | "seller" | null>(null);
  const [negotiationDiscountInput, setNegotiationDiscountInput] = useState("0");
  const [negotiationLines, setNegotiationLines] = useState<NegotiationLineItem[]>([]);
  const [negotiationNote, setNegotiationNote] = useState("");
  const { data, loading, error, refetch } = useQuery<QuoteDetailData>(QUOTE_DETAIL_QUERY, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });

  const quote = data?.quote ?? null;
  const {
    actingRole,
    buyerDeclineNote,
    buyerNegotiationNote,
    buyerReviewState,
    buyerReviewUpdatedAt,
    convertedAt,
    convertedOrderId,
    convertedOrderNumber,
    requestedDiscount,
    requestedLineItems,
    sellerNegotiationNote,
    sellerReviewUpdatedAt,
    sourceCartId
  } = workflow;

  const persistWorkflow = (next: BuyerWorkflowSnapshot) => {
    const payload: BuyerWorkflowState = {
      actingRole: next.actingRole || workflow.actingRole,
      buyerDeclineNote: next.buyerDeclineNote === undefined ? workflow.buyerDeclineNote : next.buyerDeclineNote || "",
      buyerReviewState: next.buyerReviewState || workflow.buyerReviewState,
      buyerReviewUpdatedAt:
        next.buyerReviewUpdatedAt === undefined ? workflow.buyerReviewUpdatedAt : next.buyerReviewUpdatedAt,
      buyerNegotiationNote:
        next.buyerNegotiationNote === undefined ? workflow.buyerNegotiationNote : next.buyerNegotiationNote || "",
      convertedAt: next.convertedAt === undefined ? workflow.convertedAt : next.convertedAt,
      convertedOrderId:
        next.convertedOrderId === undefined ? workflow.convertedOrderId : next.convertedOrderId || "",
      convertedOrderNumber:
        next.convertedOrderNumber === undefined ? workflow.convertedOrderNumber : next.convertedOrderNumber || "",
      requestedDiscount: next.requestedDiscount === undefined ? workflow.requestedDiscount : next.requestedDiscount || "",
      requestedLineItems:
        next.requestedLineItems === undefined ? workflow.requestedLineItems : next.requestedLineItems || [],
      sellerNegotiationNote:
        next.sellerNegotiationNote === undefined ? workflow.sellerNegotiationNote : next.sellerNegotiationNote || "",
      sellerReviewUpdatedAt:
        next.sellerReviewUpdatedAt === undefined ? workflow.sellerReviewUpdatedAt : next.sellerReviewUpdatedAt,
      sourceCartId: next.sourceCartId === undefined ? workflow.sourceCartId : next.sourceCartId || ""
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
  const activeLineDraft = negotiatingAs ? negotiationLines : requestedLineItems;
  const displayLineItems =
    activeLineDraft.length > 0
      ? activeLineDraft
      : quote.lineItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: String(item.quantity),
          sku: item.sku || "",
          unitPrice: String(moneyAmount(item.unitPrice) || moneyAmount(item.totalPrice) / Math.max(item.quantity, 1))
        }));
  const displaySubtotal = displayLineItems.reduce(
    (sum, item) => sum + inputAmount(item.quantity) * inputAmount(item.unitPrice),
    0
  );
  const displayDiscountInput = negotiatingAs
    ? negotiationDiscountInput
    : requestedDiscount || requestedDiscountFromComment(quote.comment);
  const displayDiscount = Number(displayDiscountInput);
  const hasDisplayDiscount = displayDiscountInput.trim() !== "" && Number.isFinite(displayDiscount);
  const displayTotal =
    hasDisplayDiscount
      ? displaySubtotal * ((100 - displayDiscount) / 100)
      : totals.total;
  const backendStatus = baseQuoteStatusLabel(quote.status);
  const displayStatus = workflowStatusLabel(backendStatus, buyerReviewState, convertedOrderId);
  const timeline = buildTimeline(
    quote,
    buyerReviewState,
    buyerReviewUpdatedAt,
    buyerNegotiationNote,
    buyerDeclineNote,
    sellerNegotiationNote,
    sellerReviewUpdatedAt,
    convertedAt,
    convertedOrderId,
    convertedOrderNumber
  );
  const waitingOnSeller = backendStatus === "Requested";
  const terminalStatus = ["Accepted", "Approved", "Rejected", "Declined", "Cancelled", "Converted"].includes(
    displayStatus
  );
  const buyerCanAct =
    actingRole === "buyer" &&
    waitingOnSeller &&
    ["pending", "seller-changes-requested"].includes(buyerReviewState) &&
    !terminalStatus;
  const sellerCanAct =
    actingRole === "seller" &&
    waitingOnSeller &&
    ["approved", "changes-requested"].includes(buyerReviewState) &&
    !terminalStatus &&
    !actionLoading;
  const canConvertToOrder = displayStatus === "Accepted" && buyerReviewState === "approved" && !convertedOrderId;
  const negotiationDiscount = Number(negotiationDiscountInput);
  const hasValidNegotiationDiscount =
    negotiationDiscountInput.trim() !== "" &&
    Number.isFinite(negotiationDiscount) &&
    negotiationDiscount >= 0 &&
    negotiationDiscount <= 100;
  const hasValidNegotiationLines =
    !negotiatingAs ||
    (negotiationLines.length > 0 &&
      negotiationLines.every((line) => {
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        return (
          line.name.trim() &&
          line.sku.trim() &&
          line.quantity.trim() &&
          line.unitPrice.trim() &&
          Number.isFinite(quantity) &&
          quantity > 0 &&
          Number.isFinite(unitPrice) &&
          unitPrice >= 0
        );
      }));
  const negotiationSubtotal = negotiationLines.reduce(
    (sum, line) => sum + inputAmount(line.quantity) * inputAmount(line.unitPrice),
    0
  );
  const negotiationTotal = negotiationSubtotal * ((100 - (hasValidNegotiationDiscount ? negotiationDiscount : 0)) / 100);
  const canSendNegotiation = Boolean(
    negotiationNote.trim() && hasValidNegotiationLines && hasValidNegotiationDiscount
  );

  const createNegotiationLines = () =>
    displayLineItems.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      sku: item.sku,
      unitPrice: item.unitPrice
    }));

  const updateNegotiationLine = (lineId: string, patch: Partial<NegotiationLineItem>) => {
    setNegotiationLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const syncSourceCartForConversion = async () => {
    if (!quote || !sourceCartId) return;

    const finalById = new Map(displayLineItems.map((item) => [item.id, item]));
    const updateActions: Array<Record<string, unknown>> = [];

    for (const original of quote.lineItems) {
      if (!finalById.has(original.id)) {
        updateActions.push({ removeLineItem: { lineItemId: original.id } });
      }
    }

    for (const item of displayLineItems) {
      const original = quote.lineItems.find((lineItem) => lineItem.id === item.id);
      const quantity = Math.max(1, Math.trunc(inputAmount(item.quantity)));
      const unitPrice = inputAmount(item.unitPrice);
      const discountMultiplier = hasDisplayDiscount ? (100 - displayDiscount) / 100 : 1;
      const centAmount = Math.round(unitPrice * discountMultiplier * 100);

      if (original) {
        if (original.quantity !== quantity) {
          updateActions.push({ changeLineItemQuantity: { lineItemId: original.id, quantity } });
        }
        updateActions.push({
          setLineItemPrice: {
            centAmount,
            currencyCode: totals.currencyCode,
            fractionDigits: 2,
            lineItemId: original.id,
            sku: item.sku
          }
        });
      } else if (item.sku.trim()) {
        updateActions.push({ addLineItem: { quantity, sku: item.sku.trim() } });
        updateActions.push({
          setLineItemPrice: {
            centAmount,
            currencyCode: totals.currencyCode,
            fractionDigits: 2,
            sku: item.sku.trim()
          }
        });
      }
    }

    if (updateActions.length === 0) return;

    const response = await fetch(`/api/carts/${encodeURIComponent(sourceCartId)}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: updateActions })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Unable to apply negotiated quote changes to the source cart.");
    }
  };

  const addNegotiationLine = () => {
    setNegotiationLines((prev) => [
      ...prev,
      {
        id: `requested-line-${Date.now()}`,
        name: "",
        quantity: "1",
        sku: "",
        unitPrice: "0"
      }
    ]);
  };

  const removeNegotiationLine = (lineId: string) => {
    setNegotiationLines((prev) => prev.filter((line) => line.id !== lineId));
  };

  const buildNegotiationNote = (role: "buyer" | "seller", note: string) => {
    const lines = negotiationLines.map((line) => {
      const quantity = inputAmount(line.quantity);
      const unitPrice = inputAmount(line.unitPrice);
      const lineTotal = quantity * unitPrice;
      const sku = line.sku.trim() ? ` (${line.sku.trim()})` : "";
      return `- ${line.name.trim()}${sku}: qty ${quantity}, unit ${formatAmount(unitPrice, totals.currencyCode)}, total ${formatAmount(lineTotal, totals.currencyCode)}`;
    });

    return [
      `${role === "buyer" ? "Buyer" : "Seller"} note: ${note}`,
      `Requested discount: ${negotiationDiscount}%`,
      `Requested subtotal: ${formatAmount(negotiationSubtotal, totals.currencyCode)}`,
      `Requested total: ${formatAmount(negotiationTotal, totals.currencyCode)}`,
      "Requested line items:",
      ...lines
    ].join("\n");
  };

  const approveBuyerReview = () => {
    const reviewedAt = new Date().toISOString();
    setIsDecliningBuyerReview(false);
    setDeclineNote("");
    setNegotiatingAs(null);
    setNegotiationNote("");
    setActionFeedback("");
    persistWorkflow({
      actingRole: "seller",
      buyerDeclineNote: "",
      buyerReviewState: "approved",
      buyerReviewUpdatedAt: reviewedAt,
      buyerNegotiationNote: ""
    });
  };

  const declineBuyerReview = () => {
    const note = declineNote.trim();
    if (!note) return;

    const reviewedAt = new Date().toISOString();
    setIsDecliningBuyerReview(false);
    setDeclineNote("");
    setNegotiatingAs(null);
    setNegotiationNote("");
    setActionFeedback("");
    persistWorkflow({
      actingRole: "buyer",
      buyerDeclineNote: note,
      buyerReviewState: "declined",
      buyerReviewUpdatedAt: reviewedAt,
      buyerNegotiationNote: ""
    });
  };

  const startBuyerDecline = () => {
    setIsDecliningBuyerReview(true);
    setDeclineNote("");
    setNegotiatingAs(null);
    setNegotiationNote("");
    setActionFeedback("");
  };

  const cancelBuyerDecline = () => {
    setIsDecliningBuyerReview(false);
    setDeclineNote("");
  };

  const startNegotiation = (role: "buyer" | "seller") => {
    setNegotiatingAs(role);
    setNegotiationNote("");
    setIsDecliningBuyerReview(false);
    setDeclineNote("");
    setNegotiationDiscountInput(requestedDiscount || requestedDiscountFromComment(quote.comment));
    setNegotiationLines(createNegotiationLines());
    setActionFeedback("");
  };

  const cancelNegotiation = () => {
    setNegotiatingAs(null);
    setNegotiationNote("");
    setNegotiationLines([]);
  };

  const sendNegotiation = () => {
    const note = negotiationNote.trim();
    if (!note) return;

    if (negotiatingAs === "buyer") {
      const reviewedAt = new Date().toISOString();
      setActionFeedback("");
      persistWorkflow({
        actingRole: "seller",
        buyerReviewState: "changes-requested",
        buyerReviewUpdatedAt: reviewedAt,
        buyerNegotiationNote: buildNegotiationNote("buyer", note),
        requestedDiscount: negotiationDiscountInput,
        requestedLineItems: negotiationLines
      });
    } else {
      const reviewedAt = new Date().toISOString();
      setActionFeedback("");
      persistWorkflow({
        actingRole: "buyer",
        buyerReviewState: "seller-changes-requested",
        requestedDiscount: negotiationDiscountInput,
        requestedLineItems: negotiationLines,
        sellerNegotiationNote: buildNegotiationNote("seller", note),
        sellerReviewUpdatedAt: reviewedAt
      });
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

  const convertQuoteToOrder = async () => {
    if (!canConvertToOrder || !sourceCartId) return;

    setActionLoading("Converted");
    setActionFeedback("");

    try {
      await syncSourceCartForConversion();

      const response = await fetch(`/api/carts/${encodeURIComponent(sourceCartId)}/order`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        orderNumber?: string | null;
      };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Unable to convert quote to order.");
      }

      persistWorkflow({
        convertedAt: new Date().toISOString(),
        convertedOrderId: payload.id,
        convertedOrderNumber: payload.orderNumber || payload.id
      });
      setActionFeedback(`Quote converted to order ${payload.orderNumber || payload.id}.`);
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : "Unable to convert quote to order.");
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
            {displayLineItems.length === 0 ? (
              <CardEmpty icon="shopping-bag" title="No line items" />
            ) : (
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
                  {displayLineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.sku || "--"}</TableCell>
                      <TableCell className="font-semibold text-m-text">{item.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatAmount(inputAmount(item.unitPrice), totals.currencyCode)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatAmount(inputAmount(item.quantity) * inputAmount(item.unitPrice), totals.currencyCode)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          {displayLineItems.length > 0 && (
            <SectionCard title="Quote summary">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-m-text-muted">
                  <span>Subtotal</span>
                  <span>{formatAmount(displaySubtotal, totals.currencyCode)}</span>
                </div>
                <div className="flex justify-between text-m-text-muted">
                  <span>Order discount</span>
                  <span>{hasDisplayDiscount ? `-${displayDiscount}%` : "--"}</span>
                </div>
                <div className="flex justify-between border-t border-m-border pt-3 text-base font-bold text-m-text">
                  <span>Total</span>
                  <span>{formatAmount(displayTotal, totals.currencyCode)}</span>
                </div>
              </div>
            </SectionCard>
          )}

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
                    : displayStatus === "Buyer Review"
                      ? "Changes returned by seller"
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
                          <div
                            key={detail.label}
                            className={
                              detail.value.includes("\n")
                                ? "space-y-1"
                                : "flex items-center justify-between gap-3"
                            }
                          >
                            <dt className="text-m-text-muted">{detail.label}</dt>
                            <dd className="whitespace-pre-line font-semibold text-m-text">{detail.value}</dd>
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
                      : buyerReviewState === "seller-changes-requested"
                        ? "Seller requested changes. Buyer can approve, decline, or negotiate again."
                        : "Buyer declined the quote in Studio."}
              </div>
            )}

            {actingRole === "seller" && (
              <div className="mt-4 rounded-m-md border border-m-border bg-m-surface-2 px-3 py-2 text-xs font-semibold text-m-text-muted">
                {terminalStatus
                  ? `This quote is ${displayStatus}. No further review action is available.`
                  : buyerReviewState === "pending"
                    ? "Waiting for buyer approval before seller response."
                    : buyerReviewState === "seller-changes-requested"
                      ? "Waiting for buyer response."
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

            {convertedOrderId ? (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-m-md border border-m-success-border bg-m-success-light px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-m-success">Converted to order</p>
                  <p className="text-xs text-m-text-muted">
                    Order {convertedOrderNumber || convertedOrderId} is available in the orders list.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/orders/${encodeURIComponent(convertedOrderId)}`)}
                >
                  View order
                </Button>
              </div>
            ) : displayStatus === "Accepted" ? (
              <div className="mt-4 space-y-3 rounded-m-lg border border-m-primary-200 bg-m-primary-50 p-4">
                <div>
                  <p className="text-sm font-bold text-m-text">Ready to convert</p>
                  <p className="mt-1 text-xs text-m-text-muted">
                    Create an order after buyer approval and seller acceptance.
                  </p>
                  {!sourceCartId && (
                    <p className="mt-1 text-xs font-semibold text-m-warning">
                      Source cart is not available for this quote, so conversion cannot run.
                    </p>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={actionLoading === "Converted"}
                  disabled={!canConvertToOrder || !sourceCartId || actionLoading === "Converted"}
                  onClick={convertQuoteToOrder}
                >
                  Convert to order
                </Button>
              </div>
            ) : null}

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
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!buyerCanAct && !isDecliningBuyerReview}
                      onClick={isDecliningBuyerReview ? cancelBuyerDecline : startBuyerDecline}
                    >
                      {isDecliningBuyerReview ? "Cancel" : "Decline"}
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

            {actingRole === "buyer" && isDecliningBuyerReview && (
              <div className="mt-4 space-y-3 border-t border-m-border pt-4">
                <TextArea
                  value={declineNote}
                  onChange={(event) => setDeclineNote(event.target.value)}
                  placeholder="Why are you declining this quote? (shared with the other side)"
                  resize="vertical"
                />
                <div className="flex justify-start">
                  <Button variant="danger" size="sm" disabled={!declineNote.trim()} onClick={declineBuyerReview}>
                    Decline quote
                  </Button>
                </div>
              </div>
            )}

            {negotiatingAs && (
              <div className="mt-4 space-y-3 border-t border-m-border pt-4">
                <div className="space-y-3 rounded-m-md border border-m-border bg-m-surface-2 p-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-m-text">
                      Requested discount (%)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={negotiationDiscountInput}
                      error={!hasValidNegotiationDiscount}
                      onChange={(event) => setNegotiationDiscountInput(event.target.value)}
                    />
                    {!hasValidNegotiationDiscount && (
                      <p className="mt-1 text-xs font-medium text-m-danger">
                        Enter a discount from 0 to 100.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-m-text">Requested line items</p>
                      <Button variant="outline" size="sm" onClick={addNegotiationLine}>
                        Add line
                      </Button>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {negotiationLines.map((line) => (
                        <div key={line.id} className="space-y-2 rounded-m-md border border-m-border bg-m-surface p-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-m-text-muted">
                              Product name
                            </label>
                            <Input
                              value={line.name}
                              placeholder="Product name"
                              onChange={(event) => updateNegotiationLine(line.id, { name: event.target.value })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-m-text-muted">
                              SKU
                            </label>
                            <Input
                              value={line.sku}
                              placeholder="SKU"
                              onChange={(event) => updateNegotiationLine(line.id, { sku: event.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-m-text-muted">
                                Quantity
                              </label>
                              <Input
                                type="number"
                                min={1}
                                value={line.quantity}
                                placeholder="Qty"
                                onChange={(event) => updateNegotiationLine(line.id, { quantity: event.target.value })}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-m-text-muted">
                                Unit price
                              </label>
                              <Input
                                type="number"
                                min={0}
                                value={line.unitPrice}
                                placeholder="Unit price"
                                readOnly
                                className="bg-m-surface-2"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-semibold text-m-text">
                              {formatAmount(
                                inputAmount(line.quantity) * inputAmount(line.unitPrice),
                                totals.currencyCode
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={negotiationLines.length === 1}
                              onClick={() => removeNegotiationLine(line.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!hasValidNegotiationLines && (
      <p className="text-xs font-medium text-m-danger">
                        Each requested line needs a product name, SKU, and quantity.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 border-t border-m-border pt-2 text-xs">
                    <div className="flex justify-between text-m-text-muted">
                      <span>Requested subtotal</span>
                      <span>{formatAmount(negotiationSubtotal, totals.currencyCode)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-m-text">
                      <span>Requested total</span>
                      <span>{formatAmount(negotiationTotal, totals.currencyCode)}</span>
                    </div>
                  </div>
                </div>
                <TextArea
                  value={negotiationNote}
                  onChange={(event) => setNegotiationNote(event.target.value)}
                  placeholder={
                    negotiatingAs === "buyer"
                      ? "Add negotiation notes for the seller"
                      : "Add negotiation notes for the buyer"
                  }
                  resize="vertical"
                />
                <div className="flex justify-start">
                  <Button variant="primary" size="sm" disabled={!canSendNegotiation} onClick={sendNegotiation}>
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
