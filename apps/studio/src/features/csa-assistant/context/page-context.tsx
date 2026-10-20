"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { stripLocalePrefix } from "@/i18n/routing";
import type { PageContext, PageEntityType, StudioPageType } from "../types";

export interface ContextPillInfo {
  icon: string;
  label: string;
  detail?: string;
  badgeTone?: "info" | "success" | "warning" | "neutral";
}

interface PageContextStore {
  context: PageContext;
  contextPill: ContextPillInfo;
  suggestedPrompts: string[];
  registerPageContext: (source: string, data: Partial<PageContext>) => void;
  unregisterPageContext: (source: string) => void;
}

const PageContextReact = createContext<PageContextStore | null>(null);

function parseRouteContext(pathname: string): {
  pageType: StudioPageType;
  entityType?: PageEntityType;
  entityId?: string;
  route: string;
} {
  const cleanPath = stripLocalePrefix(pathname || "/");
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length === 0 || cleanPath === "/dashboard") {
    return { pageType: "dashboard", route: cleanPath };
  }

  const [section, second, third] = segments;

  if (section === "orders") {
    if (second && second !== "create") {
      return {
        pageType: "order_details",
        entityType: "order",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "order_list", entityType: "order", route: cleanPath };
  }

  if (section === "customers") {
    if (second && second !== "create") {
      return {
        pageType: "customer_details",
        entityType: "customer",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "customer_list", entityType: "customer", route: cleanPath };
  }

  if (section === "tickets") {
    if (second && second !== "create") {
      return {
        pageType: "ticket_details",
        entityType: "ticket",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "ticket_list", entityType: "ticket", route: cleanPath };
  }

  if (section === "products") {
    if (second) {
      return {
        pageType: "product_details",
        entityType: "product",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "product_list", entityType: "product", route: cleanPath };
  }

  if (section === "cart") {
    if (second) {
      return {
        pageType: "cart_details",
        entityType: "cart",
        entityId: decodeURIComponent(second),
        route: cleanPath,
      };
    }
    return { pageType: "cart_list", entityType: "cart", route: cleanPath };
  }

  if (section === "csa-assistant") {
    return { pageType: "csa_assistant", route: cleanPath };
  }

  if (section === "reports") {
    return { pageType: "reports", route: cleanPath };
  }

  if (section === "knowledgebase") {
    return { pageType: "knowledgebase", route: cleanPath };
  }

  if (section === "b2b") {
    if (second === "company") {
      return { pageType: "b2b_company", entityType: "businessUnit", entityId: third, route: cleanPath };
    }
    if (second === "employees") {
      return { pageType: "b2b_employees", entityType: "customer", entityId: third, route: cleanPath };
    }
  }

  return { pageType: "general", route: cleanPath };
}

function computeContextPill(context: PageContext): ContextPillInfo {
  const { pageType, entityId, recordSummary, visibleRecords, activeFilters } = context;

  if (pageType === "order_details") {
    const orderNum = (recordSummary?.orderNumber as string) || entityId;
    const status = recordSummary?.orderState as string;
    return {
      icon: "shopping-bag",
      label: `Order #${orderNum}`,
      detail: status ? `Status: ${status}` : undefined,
      badgeTone: "info",
    };
  }

  if (pageType === "customer_details") {
    const name = (recordSummary?.name as string) || (recordSummary?.firstName ? `${recordSummary.firstName} ${recordSummary.lastName || ""}`.trim() : undefined) || entityId;
    return {
      icon: "user",
      label: `Customer: ${name}`,
      detail: recordSummary?.email as string,
      badgeTone: "info",
    };
  }

  if (pageType === "ticket_details") {
    const ticketNum = (recordSummary?.ticketNumber as string) || entityId;
    const priority = recordSummary?.priority as string;
    return {
      icon: "ticket",
      label: `Ticket #${ticketNum}`,
      detail: priority ? `Priority: ${priority}` : undefined,
      badgeTone: priority === "Urgent" ? "warning" : "info",
    };
  }

  if (pageType === "product_details") {
    const name = (recordSummary?.name as string) || (recordSummary?.sku as string) || entityId;
    return {
      icon: "package",
      label: `Product: ${name}`,
      detail: recordSummary?.sku ? `SKU: ${recordSummary.sku}` : undefined,
      badgeTone: "neutral",
    };
  }

  if (pageType === "cart_details") {
    return {
      icon: "shopping-cart",
      label: `Cart #${entityId}`,
      badgeTone: "neutral",
    };
  }

  if (pageType === "order_list") {
    const count = visibleRecords?.length;
    const query = activeFilters?.search;
    return {
      icon: "shopping-bag",
      label: query ? `Orders ("${query}")` : "Orders List",
      detail: count ? `${count} visible` : undefined,
      badgeTone: "neutral",
    };
  }

  if (pageType === "customer_list") {
    const count = visibleRecords?.length;
    const query = activeFilters?.search;
    return {
      icon: "users",
      label: query ? `Customers ("${query}")` : "Customer Directory",
      detail: count ? `${count} visible` : undefined,
      badgeTone: "neutral",
    };
  }

  if (pageType === "ticket_list") {
    const count = visibleRecords?.length;
    return {
      icon: "ticket",
      label: "Support Tickets",
      detail: count ? `${count} visible` : undefined,
      badgeTone: "neutral",
    };
  }

  if (pageType === "product_list") {
    const count = visibleRecords?.length;
    return {
      icon: "package",
      label: "Product Catalog",
      detail: count ? `${count} visible` : undefined,
      badgeTone: "neutral",
    };
  }

  if (pageType === "cart_list") {
    return {
      icon: "shopping-cart",
      label: "Carts & Quotes",
      badgeTone: "neutral",
    };
  }

  return {
    icon: "sparkles",
    label: "Customer CX",
    detail: "Ready to assist",
    badgeTone: "neutral",
  };
}

function computeSuggestedPrompts(context: PageContext): string[] {
  const { pageType, recordSummary } = context;

  switch (pageType) {
    case "order_details":
      return [
        "What's the status of this order?",
        "Create a ticket for this issue",
        "Check return eligibility for this order",
      ];
    case "customer_details": {
      const name = recordSummary?.name || "them";
      return [
        `What are ${name}'s latest orders?`,
        "Show open support tickets for this customer",
        "Summarize this customer's account",
      ];
    }
    case "customer_list":
      return [
        "What's the latest progress on Rahul's order?",
        "Find high value customers with open tickets",
        "Look up a customer by email",
      ];
    case "order_list":
      return [
        "Show recent pending or delayed orders",
        "Find orders needing attention",
        "Look up order status by customer name",
      ];
    case "ticket_details":
      return [
        "Summarize this ticket issue",
        "Draft a response to the customer",
        "Check linked order status",
      ];
    case "ticket_list":
      return [
        "Show urgent unresolved tickets",
        "Find tickets related to shipping delays",
        "Create a new support ticket",
      ];
    case "product_details":
      return [
        "Check stock availability and pricing",
        "Show product variants and attributes",
        "Find customer reviews or issues with this product",
      ];
    default:
      return [
        "Help me look up a customer or order",
        "Create a support ticket",
        "Check order progress",
      ];
  }
}

export function PageContextProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  // Registry of page data from views (keyed by source string, e.g. "OrderDetailView")
  const [registry, setRegistry] = useState<Record<string, Partial<PageContext>>>({});

  // Reset registry on route change to prevent stale data leaking
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      setRegistry({});
    }
  }, [pathname]);

  const registerPageContext = useCallback((source: string, data: Partial<PageContext>) => {
    setRegistry((prev) => ({
      ...prev,
      [source]: {
        ...prev[source],
        ...data,
      },
    }));
  }, []);

  const unregisterPageContext = useCallback((source: string) => {
    setRegistry((prev) => {
      if (!prev[source]) return prev;
      const next = { ...prev };
      delete next[source];
      return next;
    });
  }, []);

  const baseRouteContext = useMemo(() => parseRouteContext(pathname), [pathname]);

  // Merge registered page data
  const mergedContext = useMemo((): PageContext => {
    // Combine all registered slices
    const combinedData: Partial<PageContext> = {};
    for (const slice of Object.values(registry)) {
      Object.assign(combinedData, slice);
    }

    const entityType = combinedData.entityType || baseRouteContext.entityType || ("customer" as PageEntityType);
    const entityId = combinedData.entityId || baseRouteContext.entityId || combinedData.id || "";

    return {
      type: entityType,
      id: entityId,
      entityType,
      entityId,
      pageType: combinedData.pageType || baseRouteContext.pageType,
      route: baseRouteContext.route,
      recordSummary: combinedData.recordSummary,
      selectedRecord: combinedData.selectedRecord,
      selectedRows: combinedData.selectedRows,
      visibleRecords: combinedData.visibleRecords,
      activeFilters: combinedData.activeFilters || {
        search: searchParams?.get("q") || searchParams?.get("search") || undefined,
      },
      parentRelationship: combinedData.parentRelationship,
      timestamp: Date.now(),
      ...combinedData,
    };
  }, [baseRouteContext, registry, searchParams]);

  const contextPill = useMemo(() => computeContextPill(mergedContext), [mergedContext]);
  const suggestedPrompts = useMemo(() => computeSuggestedPrompts(mergedContext), [mergedContext]);

  const value = useMemo<PageContextStore>(
    () => ({
      context: mergedContext,
      contextPill,
      suggestedPrompts,
      registerPageContext,
      unregisterPageContext,
    }),
    [mergedContext, contextPill, suggestedPrompts, registerPageContext, unregisterPageContext]
  );

  return <PageContextReact.Provider value={value}>{children}</PageContextReact.Provider>;
}

export function usePageContext(): PageContextStore {
  const ctx = useContext(PageContextReact);
  if (!ctx) {
    // Return graceful fallback if rendered outside provider
    const fallbackContext: PageContext = {
      type: "customer",
      id: "",
      route: "/",
      pageType: "general",
      timestamp: Date.now(),
    };
    return {
      context: fallbackContext,
      contextPill: computeContextPill(fallbackContext),
      suggestedPrompts: computeSuggestedPrompts(fallbackContext),
      registerPageContext: () => {},
      unregisterPageContext: () => {},
    };
  }
  return ctx;
}

/**
 * Hook for views to register live structured data into the global page context.
 * Automatically cleans up on unmount.
 */
export function useRegisterPageContext(
  sourceName: string,
  data: Partial<PageContext> | null | undefined,
  deps: unknown[] = []
) {
  const { registerPageContext, unregisterPageContext } = usePageContext();

  useEffect(() => {
    if (!data) {
      unregisterPageContext(sourceName);
      return;
    }
    registerPageContext(sourceName, data);

    return () => {
      unregisterPageContext(sourceName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceName, registerPageContext, unregisterPageContext, ...deps]);
}
