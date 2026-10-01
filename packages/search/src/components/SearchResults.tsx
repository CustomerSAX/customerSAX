"use client";

import { useHits, useInstantSearch } from "react-instantsearch";
import { CatalogResults, type CatalogResultsProps } from "./CatalogResults";
import { normalizeSearchResultItem } from "../config/searchConfig";
import type { SearchFieldMapping } from "../contracts/types";

export interface SearchResultsProps extends Omit<
  CatalogResultsProps,
  "items" | "loading" | "error" | "onRetry"
> {
  fieldMapping?: SearchFieldMapping;
  onResetFilters?: () => void;
}
export function SearchResults({
  fieldMapping,
  onResetFilters,
  ...props
}: SearchResultsProps) {
  const { hits } = useHits();
  const { status, error, refresh } = useInstantSearch();
  return (
    <CatalogResults
      {...props}
      items={hits.map((hit) =>
        normalizeSearchResultItem(hit as Record<string, unknown>, fieldMapping)
      )}
      loading={(status === "loading" || status === "stalled") && hits.length === 0}
      error={error?.message}
      onRetry={refresh}
      onReset={onResetFilters}
    />
  );
}
