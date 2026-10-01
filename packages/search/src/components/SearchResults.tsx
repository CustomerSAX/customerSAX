"use client";

import { useHits, useInstantSearch } from "react-instantsearch";
import { Button, Skeleton } from "@csa/ui";
import { SearchResultCard, formatSearchPrice } from "./SearchResultCard";
import { SearchEmptyState } from "./SearchEmptyState";
import { SearchErrorState } from "./SearchErrorState";
import { normalizeSearchResultItem } from "../config/searchConfig";
import type { NormalizedSearchResultItem, SearchFieldMapping } from "../contracts/types";

export interface SearchResultsProps {
  fieldMapping?: SearchFieldMapping;
  layout?: "grid" | "list" | "table";
  className?: string;
  onResetFilters?: () => void;
  onViewDetails?: (item: NormalizedSearchResultItem) => void;
}

export function SearchResults({
  fieldMapping,
  layout = "list",
  className = "",
  onResetFilters,
  onViewDetails
}: SearchResultsProps) {
  const { hits } = useHits();
  const { status, error, refresh } = useInstantSearch();

  const isLoading = status === "loading" && hits.length === 0;

  if (error) {
    return (
      <SearchErrorState
        message="Unable to load search results. Please check your connection and try again."
        onRetry={() => refresh()}
        className={className}
      />
    );
  }

  if (isLoading) {
    return (
      <div
        className={`flex flex-col gap-4 w-full ${className}`}
        aria-busy="true"
        aria-label="Loading results"
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 rounded-m-xl border border-m-border bg-m-surface flex flex-col sm:flex-row gap-5 items-start"
          >
            <Skeleton className="h-28 w-14 rounded-m-md shrink-0 self-center sm:self-start" />
            <div className="flex-1 w-full space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1.5 w-1/2">
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-3.5 w-40 rounded" />
                </div>
                <div className="space-y-2 flex flex-col items-end">
                  <Skeleton className="h-4 w-28 rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-12 rounded" />
                    <Skeleton className="h-8 w-24 rounded" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-20 w-full rounded-m-lg mt-3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (hits.length === 0) {
    return <SearchEmptyState onReset={onResetFilters} className={className} />;
  }

  const items = hits.map((hit) =>
    normalizeSearchResultItem(hit as Record<string, unknown>, fieldMapping)
  );
  if (layout === "table")
    return (
      <div
        className={`overflow-x-auto rounded-m-xl border border-m-border bg-m-surface ${className}`}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Products</caption>
          <thead className="border-b border-m-border bg-m-surface-2 text-xs text-m-text-muted">
            <tr>
              {["Product Name", "Product Type", "SKU", "Price", "Availability", ""].map(
                (label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">
                    {label || <span className="sr-only">Actions</span>}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-m-border">
            {items.map((item) => (
              <tr key={String(item.raw.objectID || item.id)}>
                <td className="px-4 py-3 font-medium text-m-text">{item.title}</td>
                <td className="px-4 py-3">{item.category || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.sku || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatSearchPrice(item)}</td>
                <td className="px-4 py-3">
                  {item.stockStatus ||
                    (item.inStock === undefined
                      ? "—"
                      : item.inStock
                        ? "In Stock"
                        : "Out of Stock")}
                </td>
                <td className="px-4 py-3">
                  {onViewDetails && (
                    <Button variant="ghost" size="sm" onClick={() => onViewDetails(item)}>
                      View details
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div
      role="region"
      aria-label="Search results"
      className={`${layout === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "flex flex-col"} gap-5 w-full ${className}`}
    >
      {items.map((item) => (
        <SearchResultCard
          key={String(item.raw.objectID || item.id)}
          item={item}
          layout={layout}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}
