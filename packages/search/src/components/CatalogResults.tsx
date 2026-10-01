"use client";

import { Button, EmptyState, Skeleton } from "@csa/ui";
import { SearchResultCard, formatSearchPrice } from "./SearchResultCard";
import type { NormalizedSearchResultItem } from "../contracts/types";

export type CatalogLayout = "grid" | "list" | "table";
export interface CatalogResultsProps {
  items: NormalizedSearchResultItem[];
  loading?: boolean;
  error?: string | null;
  layout?: CatalogLayout;
  className?: string;
  onRetry?: () => void;
  onReset?: () => void;
  onViewDetails?: (item: NormalizedSearchResultItem) => void;
}

export function CatalogResults({
  items,
  loading,
  error,
  layout = "grid",
  className = "",
  onRetry,
  onReset,
  onViewDetails
}: CatalogResultsProps) {
  if (error)
    return (
      <div
        role="alert"
        className="rounded-m-xl border border-m-border bg-m-surface p-8 text-center"
      >
        <p className="mb-4 text-sm text-m-danger">{error}</p>
        {onRetry && <Button onClick={onRetry}>Retry</Button>}
      </div>
    );
  if (loading)
    return (
      <div
        aria-busy="true"
        aria-label="Loading products"
        className={
          layout === "grid"
            ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            : "space-y-5"
        }
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton
            key={i}
            height={layout === "grid" ? 360 : 200}
            className="rounded-m-xl"
          />
        ))}
      </div>
    );
  if (items.length === 0)
    return (
      <EmptyState
        icon="package"
        title="No products found"
        description="Try adjusting your search or filters."
        action={
          onReset ? (
            <Button variant="outline" onClick={onReset}>
              Reset Search
            </Button>
          ) : undefined
        }
      />
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
