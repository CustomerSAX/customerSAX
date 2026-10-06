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
  useRef,
} from "react";
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
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [products, setProducts] = useState<ProductListRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  // Start loading so skeleton shows on first paint (no flash of empty state).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  // Next's native history integration updates useSearchParams and supports
  // back/forward navigation without reloading the page or resetting the view.
  const setPage = useCallback((nextPage: number) => {
    const href = productPageHref(window.location.href, nextPage);
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== currentHref) window.history.pushState(null, "", href);
  }, []);
  const [perPage] = useState(20);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Monotonic sequence counter — prevents stale fetch results from overwriting
  // the latest ones (race condition guard matching legacy searchSeq pattern).
  const searchSeq = useRef(0);

  // -------------------------------------------------------------------------
  // Price resolution (standalone prices from BFF)
  // -------------------------------------------------------------------------

  const resolvePrices = useCallback(
    async (rows: ProductListRow[]): Promise<ProductListRow[]> => {
      const skus = rows
        .map((r) => r.sku)
        .filter((sku) => sku && sku !== "--");
      if (skus.length === 0) return rows;

      try {
        // Resolve prices for all SKUs in parallel (BFF standalonePrices is per-SKU,
        // so we batch them client-side).
        const priceResults = await Promise.all(
          skus.map(async (sku): Promise<StandalonePriceResult | null> => {
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
              // Return lowest price for this SKU
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
              return sorted[0] ? { sku, value: sorted[0].value } : null;
            } catch {
              return null;
            }
          })
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
  // Main fetch
  // -------------------------------------------------------------------------

  const doSearch = useCallback(
    async (searchQuery: ProductSearch, sortState: ProductSort | null, currentPage: number) => {
      const seq = ++searchSeq.current;
      const trimmed = searchQuery.text.trim();
      setLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * perPage;
        const requestBody = trimmed
          ? {
              field: searchQuery.option,
              text: trimmed,
              limit: perPage,
              offset,
            }
          : {
              browse: true,
              limit: perPage,
              offset,
              sortKey: sortState ? browseSortField(sortState.key) : undefined,
              sortOrder: sortState?.order,
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

        const withPrices = rawResults.every((product) => product.resolvedPrice !== undefined) ? rows : await resolvePrices(rows);

        // Drop stale results
        if (seq !== searchSeq.current) return;

        setFacets(json.facets ?? null);
        setProducts(withPrices);
        setTotalItems(total);
        setExpanded(new Set());
      } catch (e) {
        if (seq === searchSeq.current) {
          console.error("Product search error:", e);
          setError(
            e instanceof Error ? e.message : "Failed to load products."
          );
        }
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    },
    [locale, perPage, resolvePrices, filters]
  );

  // -------------------------------------------------------------------------
  // Auto-search debounce effect (mirrors legacy)
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Skip when nothing has actually changed (avoids double-fire in StrictMode).
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
  // Run fetch whenever applied search, page, or sort changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    void doSearch(appliedSearch, sort, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch.text, appliedSearch.option, page, sort?.key, sort?.order, filters]);

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
    onRetry: () => { void doSearch(appliedSearch, sort, page); },
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
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${encodeURIComponent(id)}`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Product not found (HTTP ${res.status})`);
        }
        return res.json() as Promise<CtRawProduct | null>;
      })
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setProduct(null);
        } else {
          setProduct(mapRawToDetail(raw));
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Product detail fetch error:", e);
        setError(
          e instanceof Error ? e.message : "Failed to load product."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { product, loading, error };
}
