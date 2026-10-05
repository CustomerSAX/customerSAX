"use client";

import { useState, type ReactNode } from "react";
import { Button, Drawer, DrawerHeader, DrawerContent, PageHeader } from "@csa/ui";
import { LayoutGrid, List, Table2 } from "lucide-react";
import {
  CatalogResults,
  type CatalogLayout,
  type CatalogResultsProps
} from "./CatalogResults";
import { SearchProviderStatus } from "./SearchProviderStatus";
import { SearchResultCard } from "./SearchResultCard";
import type { SearchCapabilityState } from "../contracts/SearchCapability";
import type { NormalizedSearchResultItem } from "../contracts/types";

/** Provider-independent Products UI. Adapters supply normalized records and controls. */
export interface CatalogViewProps extends Omit<
  CatalogResultsProps,
  "layout" | "onViewDetails"
> {
  provider: SearchCapabilityState;
  search?: ReactNode;
  filters?: ReactNode;
  stats?: ReactNode;
  sort?: ReactNode;
  pagination?: ReactNode;
}

export function CatalogView({
  provider,
  search,
  filters,
  stats,
  sort,
  pagination,
  ...results
}: CatalogViewProps) {
  const [layout, setLayout] = useState<CatalogLayout>("grid");
  const [selectedProduct, setSelectedProduct] =
    useState<NormalizedSearchResultItem | null>(null);
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Products"
        subtitle="Browse and search your product catalog."
        breadcrumbs={
          <span className="text-xs font-semibold uppercase tracking-widest text-m-text-muted">
            Commerce
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SearchProviderStatus state={provider} />
            <div
              role="group"
              aria-label="Product view"
              className="flex rounded-m-lg border border-m-border bg-m-surface p-1"
            >
              {(
                [
                  ["grid", LayoutGrid],
                  ["list", List],
                  ["table", Table2]
                ] as const
              ).map(([value, ViewIcon]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={layout === value ? "secondary" : "ghost"}
                  aria-pressed={layout === value}
                  onClick={() => setLayout(value)}
                >
                  <ViewIcon className="mr-2 h-4 w-4" />
                  {value[0].toUpperCase() + value.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        }
      />
      {search && (
        <div role="search" aria-label="Product search">
          {search}
        </div>
      )}
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        {filters && (
          <aside
            aria-label="Catalog filters"
            className="w-full shrink-0 lg:sticky lg:top-6 lg:w-72 xl:w-80"
          >
            {filters}
          </aside>
        )}
        <section aria-label="Products" className="w-full min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {stats}
            {sort}
          </div>
          <CatalogResults
            {...results}
            layout={layout}
            onViewDetails={setSelectedProduct}
          />
          {pagination}
        </section>
      </div>
      <Drawer
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        position="right"
        size="md"
        aria-label="Product details"
      >
        <DrawerHeader
          title={selectedProduct?.title || "Product details"}
          onClose={() => setSelectedProduct(null)}
        />
        <DrawerContent className="space-y-4 p-5">
          {selectedProduct && (
            <>
              <SearchResultCard item={selectedProduct} layout="grid" />
              <p className="whitespace-pre-line text-sm text-m-text">
                {selectedProduct.description || "No description available."}
              </p>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
