"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CatalogView, normalizeSearchResultItem } from "@csa/search";
import { Button, SearchBar } from "@csa/ui";
import { useTranslations } from "next-intl";
import type { HubProducts } from "../../../lib/connection-hub";

export function ConnectionHubCatalogProvider() {
  const t = useTranslations("Products");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<HubProducts>({ results: [], total: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  const scheduled = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async (search: string) => {
    if (scheduled.current) clearTimeout(scheduled.current);
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(undefined);
    setProducts({ results: [], total: null });
    try {
      const response = await fetch("/api/connection-hub/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: search, limit: 20 }),
        signal: controller.signal
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isProductsResponse(payload))
        throw new Error("Product search is temporarily unavailable. Please try again.");
      if (!controller.signal.aborted) setProducts(payload);
    } catch {
      if (!controller.signal.aborted)
        setError("Product search is temporarily unavailable. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    scheduled.current = setTimeout(() => void load(query.trim()), 350);
    return () => {
      if (scheduled.current) clearTimeout(scheduled.current);
      pending.current?.abort();
    };
  }, [load, query]);
  const reset = () => {
    if (query) setQuery("");
    else void load("");
  };
  return (
    <CatalogView
      provider={{
        enabled: true,
        providerId: "algolia",
        providerName: "Algolia",
        searchMode: "Catalog Search",
        status: error ? "error" : loading ? "loading" : "connected"
      }}
      items={products.results.map((hit) => normalizeSearchResultItem(hit))}
      loading={loading}
      error={error}
      onRetry={() => void load(query.trim())}
      onReset={reset}
      search={
        <div className="flex gap-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={() => void load(query.trim())}
            onClear={reset}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchProducts")}
            maxLength={300}
          />
          <Button onClick={() => void load(query.trim())} disabled={loading}>
            {t("searchProducts")}
          </Button>
        </div>
      }
      stats={
        error ? null : (
          <p role="status" className="text-sm text-m-text-muted">
            {loading
              ? t("loadingProducts")
              : products.total === null
                ? t("countTitle", { count: products.results.length })
                : `${t("countTitle", { count: products.total })} · ${products.results.length} shown`}
          </p>
        )
      }
    />
  );
}

function isProductsResponse(value: unknown): value is HubProducts {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("results" in value) ||
    !Array.isArray(value.results) ||
    !("total" in value)
  )
    return false;
  return (
    value.results.every(
      (hit: unknown) => typeof hit === "object" && hit !== null && !Array.isArray(hit)
    ) &&
    (value.total === null || typeof value.total === "number")
  );
}
