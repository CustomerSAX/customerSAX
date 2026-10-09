"use client";

/**
 * Product Module Hooks
 *
 * useProductList — manages product list state: search, pagination, sort,
 *   data fetching from /api/product-search, and standalone price resolution.
 *
 * useProductDetail — fetches full product detail from /api/products/[id].
 */

import {
  useState,
  useEffect,
  useCallback,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { productPageFromParam, productPageHref } from "../utils/product-pagination";
import type {
  CatalogFilters,
  CatalogFacets,
  ProductListRow,
  ProductSearch,
  ProductSort,
  ProductSortKey,
  CtRawProduct,
  ProductSearchResponse,
  StandalonePriceResult,
  ProductDetail,
} from "../types/product-types";
import {
  mapRawToListRow,
  mapRawToDetail,
  lowestPriceBySku,
  formatMoneyValue,
  browseSortField,
} from "../utils/product-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum characters before auto-search fires (matches legacy). */
const MIN_SEARCH_LEN = 4;

/** Debounce before auto-searching while typing (matches legacy). */
const SEARCH_DEBOUNCE_MS = 350;

// ---------------------------------------------------------------------------
// SKU Price Cache & In-Flight Request Deduplication
// ---------------------------------------------------------------------------

const skuPriceCache = new Map<string, { result: StandalonePriceResult | null; expiresAt: number }>();
const skuPriceInFlight = new Map<string, Promise<StandalonePriceResult | null>>();

async function fetchSkuPrice(sku: string): Promise<StandalonePriceResult | null> {
  const now = Date.now();
  const cached = skuPriceCache.get(sku);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const existingPromise = skuPriceInFlight.get(sku);
  if (existingPromise) {
    return existingPromise;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch("/api/products/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sku }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        results?: StandalonePriceResult[];
      };
      const results = data?.results ?? [];
      const usd = results.filter(
        (r) =>
          r?.value?.currencyCode === "USD" ||
          !r?.value?.currencyCode
      );
      const sorted = (usd.length > 0 ? usd : results).sort(
        (a, b) =>
          (a?.value?.centAmount ?? Infinity) -
          (b?.value?.centAmount ?? Infinity)
      );
      const best = sorted[0] ? { sku, value: sorted[0].value } : null;
      skuPriceCache.set(sku, { result: best, expiresAt: Date.now() + 10 * 60_000 });
      return best;
    } catch {
      return null;
    } finally {
      skuPriceInFlight.delete(sku);
    }
  })();

  skuPriceInFlight.set(sku, fetchPromise);
  return fetchPromise;
}

// ---------------------------------------------------------------------------
// useProductList
// ---------------------------------------------------------------------------

export interface UseProductListReturn {
  filters: CatalogFilters;
  facets: CatalogFacets | null;
  onFiltersChange: (filters: CatalogFilters) => void;
  products: ProductListRow[];
  totalItems: number;
  loading: boolean;
  error: string | null;
  search: ProductSearch;
  appliedSearch: ProductSearch;
  sort: ProductSort | null;
  page: number;
  perPage: number;
  expanded: Set<string>;
  setSearch: (s: ProductSearch) => void;
  onSearch: () => void;
  onRetry: () => void;
  onReset: () => void;
  onSort: (columnKey: ProductSortKey) => void;
  onSortChange: (sort: ProductSort) => void;
  onPageChange: (p: number) => void;
  onPerPageChange: (pp: number) => void;
  toggleExpanded: (id: string) => void;
}

export function useProductList(): UseProductListReturn {
  const locale = useLocale();
  const [filters, setFilters] = useState<CatalogFilters>({});
  const [search, setSearch] = useState<ProductSearch>({
    text: "",
    option: "allFields",
  });
  const [appliedSearch, setAppliedSearch] = useState<ProductSearch>({
    text: "",
    option: "allFields",
  });

  const [sort, setSort] = useState<ProductSort | null>(null);
  const searchParams = useSearchParams();
  const page = productPageFromParam(searchParams.get("page"));
  const setPage = useCallback((nextPage: number) => {
    const href = productPageHref(window.location.href, nextPage);
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== currentHref) window.history.pushState(null, "", href);
  }, []);
  const [perPage] = useState(20);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Price resolution (standalone prices from BFF)
  // -------------------------------------------------------------------------

  const resolvePrices = useCallback(
    async (rows: ProductListRow[]): Promise<ProductListRow[]> => {
      const rawSkus = rows
        .map((r) => r.sku)
        .filter((sku) => sku && sku !== "--");
      const uniqueSkus = Array.from(new Set(rawSkus));
      if (uniqueSkus.length === 0) return rows;

      try {
        const priceResults = await Promise.all(
          uniqueSkus.map((sku) => fetchSkuPrice(sku))
        );

        const flatResults = priceResults.filter(
          (r): r is StandalonePriceResult => r !== null
        );
        const lowestBySku = lowestPriceBySku(flatResults);
        if (lowestBySku.size === 0) return rows;

        return rows.map((row) => {
          const lowest = lowestBySku.get(row.sku);
          return lowest
            ? { ...row, price: `From ${formatMoneyValue(lowest)}`, priceValue: lowest }
            : row;
        });
      } catch (e) {
        console.error("Failed to resolve product prices", e);
        return rows;
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // TanStack Query for Product Search
  // -------------------------------------------------------------------------

  const queryKey = [
    "products",
    locale,
    appliedSearch.text,
    appliedSearch.option,
    sort?.key,
    sort?.order,
    page,
    perPage,
    filters,
  ];

  const {
    data: queryResult,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const trimmed = appliedSearch.text.trim();
      const offset = (page - 1) * perPage;
      const requestBody = trimmed
        ? {
            field: appliedSearch.option,
            text: trimmed,
            limit: perPage,
            offset,
          }
        : {
            browse: true,
            limit: perPage,
            offset,
            sortKey: sort ? browseSortField(sort.key) : undefined,
            sortOrder: sort?.order,
          };

      const res = await fetch("/api/product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...requestBody, includeFacets: true, filters }),
      });

      if (!res.ok) {
        throw new Error(`Product search failed: HTTP ${res.status}`);
      }

      const json = (await res.json()) as ProductSearchResponse & { error?: string };
      if (json.error) throw new Error(json.error);
      const rawResults: CtRawProduct[] = (json.results ?? []) as CtRawProduct[];
      const rows = rawResults.map((product) => mapRawToListRow(product, locale));
      const total = json.total ?? 0;

      const withPrices = rawResults.every((product) => product.resolvedPrice !== undefined)
        ? rows
        : await resolvePrices(rows);

      return {
        products: withPrices,
        totalItems: total,
        facets: json.facets ?? null,
      };
    },
    staleTime: 2 * 60_000,
  });

  const products = queryResult?.products ?? [];
  const totalItems = queryResult?.totalItems ?? 0;
  const facets = queryResult?.facets ?? null;
  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load products.") : null;

  // -------------------------------------------------------------------------
  // Auto-search debounce effect (mirrors legacy)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (
      search.text === appliedSearch.text &&
      search.option === appliedSearch.option
    ) {
      return;
    }
    const trimmed = search.text.trim();
    const timer = window.setTimeout(() => {
      if (trimmed.length > 0 && trimmed.length < MIN_SEARCH_LEN) return;
      setAppliedSearch({ text: search.text, option: search.option });
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search.text, search.option, appliedSearch.text, appliedSearch.option, setPage]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const onSearch = useCallback(() => {
    const trimmed = search.text.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_SEARCH_LEN) return;
    setAppliedSearch({ text: search.text, option: search.option });
    setPage(1);
  }, [search, setPage]);

  const onReset = useCallback(() => {
    const empty: ProductSearch = { text: "", option: "allFields" };
    setSearch(empty);
    setAppliedSearch(empty);
    setSort(null);
    setFilters({});
    setPage(1);
  }, [setPage]);

  const onSort = useCallback((columnKey: ProductSortKey) => {
    setSort((prev) =>
      prev?.key === columnKey
        ? { key: columnKey, order: prev.order === "asc" ? "desc" : "asc" }
        : { key: columnKey, order: "asc" }
    );
    setPage(1);
  }, [setPage]);

  const onPageChange = setPage;
  const onPerPageChange = useCallback(() => setPage(1), [setPage]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return {
    filters,
    facets,
    onFiltersChange: (nextFilters: CatalogFilters) => { setFilters(nextFilters); setPage(1); },
    products,
    totalItems,
    loading,
    error,
    search,
    appliedSearch,
    sort,
    page,
    perPage,
    expanded,
    setSearch,
    onSearch,
    onRetry: () => { void refetch(); },
    onReset,
    onSort,
    onSortChange: (nextSort: ProductSort) => { setSort(nextSort); setPage(1); },
    onPageChange,
    onPerPageChange,
    toggleExpanded,
  };
}

// ---------------------------------------------------------------------------
// useProductDetail
// ---------------------------------------------------------------------------

export interface UseProductDetailReturn {
  product: ProductDetail | null;
  loading: boolean;
  error: string | null;
}

export function useProductDetail(id: string): UseProductDetailReturn {
  const {
    data: product = null,
    isLoading: loading,
    error: queryError,
  } = useQuery<ProductDetail | null>({
    queryKey: ["productDetail", id],
    queryFn: async () => {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`Product not found (HTTP ${res.status})`);
      }
      const raw = (await res.json()) as CtRawProduct | null;
      return raw ? mapRawToDetail(raw) : null;
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load product.") : null;

  return { product, loading, error };
}
