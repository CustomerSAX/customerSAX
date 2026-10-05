"use client";

import { useState } from "react";
import { Badge, Button } from "@csa/ui";
import { Package } from "lucide-react";
import type { NormalizedSearchResultItem } from "../contracts/types";

export interface SearchResultCardProps {
  item: NormalizedSearchResultItem;
  className?: string;
  layout?: "grid" | "list";
  onViewDetails?: (item: NormalizedSearchResultItem) => void;
}

function ProductImage({
  src,
  title,
  grid
}: {
  src?: string;
  title: string;
  grid?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`flex items-center justify-center rounded-m-lg bg-m-surface-2 p-4 ${grid ? "aspect-square w-full" : "h-24 w-24 sm:h-28 sm:w-28"}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span role="img" aria-label={`Image unavailable for ${title}`}>
          <Package className="h-8 w-8 text-m-text-muted" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

export function formatSearchPrice(item: NormalizedSearchResultItem): string {
  if (typeof item.price !== "number") return "Price unavailable";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: item.currency || "USD"
    }).format(item.price);
  } catch {
    return `${item.price.toFixed(2)} ${item.currency || ""}`.trim();
  }
}

export function SearchResultCard({
  item,
  layout = "list",
  className = "",
  onViewDetails
}: SearchResultCardProps) {
  const grid = layout === "grid";
  const outOfStock =
    item.inStock === false || item.stockStatus?.toLowerCase().includes("out");
  const variantCount =
    typeof item.raw.variantCount === "number" ? item.raw.variantCount : undefined;
  const skus = Array.isArray(item.raw.skus)
    ? item.raw.skus.filter((sku): sku is string => typeof sku === "string")
    : [];
  return (
    <article
      className={`flex ${grid ? "flex-col" : "flex-col sm:flex-row"} gap-5 rounded-m-xl border border-m-border bg-m-surface p-5 transition-shadow hover:shadow-m-card ${className}`}
    >
      <div className={grid ? "" : "shrink-0"}>
        <ProductImage
          key={item.imageUrl || item.id}
          src={item.imageUrl}
          title={item.title}
          grid={grid}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div
          className={`flex gap-4 ${grid ? "flex-1 flex-col" : "flex-col justify-between md:flex-row"}`}
        >
          <div className="min-w-0 space-y-2">
            {item.category && (
              <p className="text-xs text-m-text-muted">{item.category}</p>
            )}
            <h3 className="text-sm font-semibold text-m-text">{item.title}</h3>
            {item.sku && (
              <p className="break-all font-mono text-xs text-m-text-muted">{item.sku}</p>
            )}
            {!grid && item.description && (
              <p className="line-clamp-2 max-w-3xl text-sm text-m-text-muted">
                {item.description}
              </p>
            )}
            {variantCount !== undefined && (
              <p className="text-xs text-m-text-muted">
                {variantCount} {variantCount === 1 ? "variant" : "variants"}
              </p>
            )}
          </div>
          <div
            className={`flex flex-col gap-3 ${grid ? "mt-auto" : "shrink-0 items-start md:items-end"}`}
          >
            <p className="text-sm font-semibold text-m-text">{formatSearchPrice(item)}</p>
            {(item.stockStatus || item.inStock !== undefined) && (
              <div>
                <Badge size="sm" variant={outOfStock ? "neutral" : "success"}>
                  {item.stockStatus || (item.inStock ? "In Stock" : "Out of Stock")}
                </Badge>
              </div>
            )}
            {onViewDetails && (
              <Button variant="outline" size="sm" onClick={() => onViewDetails(item)}>
                View details
              </Button>
            )}
          </div>
        </div>
        {!grid && skus.length > 0 && (
          <div className="overflow-x-auto rounded-m-lg border border-m-border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Product SKUs for {item.title}</caption>
              <thead className="border-b border-m-border bg-m-surface-2">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium text-m-text-muted">
                    SKU
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m-border">
                {skus.map((sku) => (
                  <tr key={sku}>
                    <td className="px-4 py-3 font-mono text-m-text">{sku}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!grid && item.components && item.components.length > 0 && (
          <div className="overflow-x-auto rounded-m-lg border border-m-border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Components of {item.title}</caption>
              <thead className="border-b border-m-border bg-m-surface-2">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Component
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m-border">
                {item.components.map((component, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">{component.quantity ?? "—"}</td>
                    <td className="px-4 py-3">{component.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}
