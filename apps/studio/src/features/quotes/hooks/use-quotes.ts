"use client";

import { gql, useQuery } from "@apollo/client";
import { useState, useCallback, useMemo } from "react";
import type { Quote, QuoteFilter, QuoteSort, QuoteStatus, QuoteNegotiationTurn, QuoteLineItem } from "../types/quote-types";

type MoneyResult = {
  centAmount: number;
  fractionDigits: number;
};

type QuoteResult = {
  id: string;
  key?: string | null;
  quoteNumber?: string | null;
  companyKey?: string | null;
  companyName?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  status?: string | null;
  totalPrice?: MoneyResult | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
};

type QuotesData = {
  quotes: {
    results: QuoteResult[];
  };
};

const QUOTES_QUERY = gql`
  query QuotesPage($limit: Int!, $offset: Int!, $sortKey: String, $sortOrder: String) {
    quotes(limit: $limit, offset: $offset, sortKey: $sortKey, sortOrder: $sortOrder) {
      results {
        id
        key
        quoteNumber
        companyKey
        companyName
        customerId
        customerEmail
        status
        totalPrice {
          centAmount
          fractionDigits
        }
        createdAt
        lastModifiedAt
      }
    }
  }
`;

function moneyToNumber(money?: MoneyResult | null) {
  if (!money) return 0;
  return money.centAmount / 10 ** money.fractionDigits;
}

function toQuoteStatus(status?: string | null): QuoteStatus {
  if (
    status === "Draft" ||
    status === "Submitted" ||
    status === "In Review" ||
    status === "Approved" ||
    status === "Declined" ||
    status === "Cancelled" ||
    status === "Converted"
  ) {
    return status;
  }

  return "Submitted";
}

function mapQuote(quote: QuoteResult): Quote {
  const total = moneyToNumber(quote.totalPrice);

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber || quote.key || quote.id,
    companyId: quote.companyKey || "",
    companyName: quote.companyName || quote.companyKey || "--",
    companyKey: quote.companyKey || "",
    customerId: quote.customerId || "",
    customerName: quote.customerEmail || quote.customerId || "--",
    customerEmail: quote.customerEmail || "",
    status: toQuoteStatus(quote.status),
    lineItems: [],
    subtotal: total,
    discountPct: 0,
    negotiatedTotal: total,
    validUntil: "",
    createdAt: quote.createdAt || "",
    lastModifiedAt: quote.lastModifiedAt || quote.createdAt || "",
    negotiationTurns: [],
  };
}

export function useQuotes() {
  const { data, loading } = useQuery<QuotesData>(QUOTES_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: {
      limit: 100,
      offset: 0,
      sortKey: "createdAt",
      sortOrder: "desc",
    },
  });
  const [localQuotes, setLocalQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<QuoteFilter>({ searchText: "" });
  const [sort, setSort] = useState<QuoteSort>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const serverQuotes = useMemo(() => (data?.quotes.results ?? []).map(mapQuote), [data?.quotes.results]);
  const quotes = useMemo(() => [...localQuotes, ...serverQuotes], [localQuotes, serverQuotes]);

  const filteredQuotes = useMemo(() => {
    let result = [...quotes];

    if (filter.companyIdFilter) {
      result = result.filter((q) => q.companyId === filter.companyIdFilter || q.companyKey === filter.companyIdFilter);
    }

    if (filter.statusFilter) {
      result = result.filter((q) => q.status === filter.statusFilter);
    }

    if (filter.searchText.trim()) {
      const query = filter.searchText.toLowerCase().trim();
      result = result.filter(
        (q) =>
          q.quoteNumber.toLowerCase().includes(query) ||
          q.companyName.toLowerCase().includes(query) ||
          q.customerName.toLowerCase().includes(query) ||
          q.customerEmail.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      const valA = a[sort.key] ?? "";
      const valB = b[sort.key] ?? "";
      if (valA < valB) return sort.order === "asc" ? -1 : 1;
      if (valA > valB) return sort.order === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [quotes, filter, sort]);

  const paginatedQuotes = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredQuotes.slice(start, start + perPage);
  }, [filteredQuotes, page, perPage]);

  const getQuoteById = useCallback(
    (id: string) => quotes.find((q) => q.id === id || q.quoteNumber === id),
    [quotes]
  );

  const createQuote = useCallback(
    (newQuote: Omit<Quote, "id" | "quoteNumber" | "createdAt" | "lastModifiedAt" | "negotiationTurns">) => {
      const count = quotes.length + 1;
      const created: Quote = {
        ...newQuote,
        id: `quote-${Date.now()}`,
        quoteNumber: `Q-${Date.now().toString().slice(-6)}-${count}`,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        negotiationTurns: [],
      };
      setLocalQuotes((prev) => [created, ...prev]);
      return created;
    },
    [quotes.length]
  );

  const updateQuoteStatus = useCallback((id: string, status: QuoteStatus, turnComment?: string, authorRole: "Buyer" | "Seller" = "Seller") => {
    setLocalQuotes((prev) =>
      prev.map((q) => {
        if (q.id !== id && q.quoteNumber !== id) return q;

        const updatedTurns = [...q.negotiationTurns];
        if (turnComment) {
          updatedTurns.push({
            id: `turn-${Date.now()}`,
            authorRole,
            authorName: authorRole === "Seller" ? "Sales Agent (CSA)" : q.customerName,
            comment: turnComment,
            timestamp: new Date().toISOString(),
          });
        }

        return {
          ...q,
          status,
          negotiationTurns: updatedTurns,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const addNegotiationTurn = useCallback(
    (id: string, comment: string, authorRole: "Buyer" | "Seller" = "Seller", offeredSubtotal?: number) => {
      setLocalQuotes((prev) =>
        prev.map((q) => {
          if (q.id !== id && q.quoteNumber !== id) return q;

          const newTurn: QuoteNegotiationTurn = {
            id: `turn-${Date.now()}`,
            authorRole,
            authorName: authorRole === "Seller" ? "Sales Agent (CSA)" : q.customerName,
            comment,
            offeredSubtotal,
            timestamp: new Date().toISOString(),
          };

          return {
            ...q,
            status: "In Review",
            negotiatedTotal: offeredSubtotal ?? q.negotiatedTotal,
            negotiationTurns: [...q.negotiationTurns, newTurn],
            lastModifiedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const updateQuoteLineItems = useCallback((id: string, lineItems: QuoteLineItem[]) => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
    setLocalQuotes((prev) =>
      prev.map((q) => {
        if (q.id !== id && q.quoteNumber !== id) return q;
        const discountMult = (100 - q.discountPct) / 100;
        return {
          ...q,
          lineItems,
          subtotal,
          negotiatedTotal: subtotal * discountMult,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  return {
    quotes: paginatedQuotes,
    allQuotes: quotes,
    totalItems: filteredQuotes.length,
    loading,
    filter,
    sort,
    page,
    perPage,
    setFilter,
    setSort,
    setPage,
    setPerPage,
    getQuoteById,
    createQuote,
    updateQuoteStatus,
    addNegotiationTurn,
    updateQuoteLineItems,
  };
}
