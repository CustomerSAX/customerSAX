"use client";

import { useState, useCallback, useMemo } from "react";
import type { Quote, QuoteFilter, QuoteSort, QuoteStatus, QuoteNegotiationTurn, QuoteLineItem } from "../types/quote-types";
import { INITIAL_QUOTES } from "../constants/mock-quotes";

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>(INITIAL_QUOTES);
  const loading = false;
  const [filter, setFilter] = useState<QuoteFilter>({ searchText: "" });
  const [sort, setSort] = useState<QuoteSort>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

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
        quoteNumber: `Q-100${26 + count}`,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        negotiationTurns: [],
      };
      setQuotes((prev) => [created, ...prev]);
      return created;
    },
    [quotes.length]
  );

  const updateQuoteStatus = useCallback((id: string, status: QuoteStatus, turnComment?: string, authorRole: "Buyer" | "Seller" = "Seller") => {
    setQuotes((prev) =>
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
      setQuotes((prev) =>
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
    setQuotes((prev) =>
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
