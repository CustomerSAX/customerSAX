"use client";

import { useMemo, useState } from "react";
import { InstantSearch } from "react-instantsearch";
import { Button, Drawer, DrawerHeader, DrawerContent, PageHeader } from "@csa/ui";
import {
  LayoutGrid,
  List,
  Table2,
  SlidersHorizontal,
  Search as SearchIcon
} from "lucide-react";
import type {
  OrganizationSearchConfig,
  SearchCapabilityState
} from "../contracts/SearchCapability";
import { SearchBox } from "./SearchBox";
import { SearchFilters } from "./SearchFilters";
import { SearchSort } from "./SearchSort";
import { SearchResultCard } from "./SearchResultCard";
import { SearchResults } from "./SearchResults";
import { SearchPagination } from "./SearchPagination";
import { SearchStats } from "./SearchStats";
import { SearchProviderStatus } from "./SearchProviderStatus";
import { SearchErrorState } from "./SearchErrorState";
import { getOrCreateAlgoliaClient } from "../providers/algolia/algoliaClient";
import { resolveAlgoliaConfig } from "../providers/algolia/configuration";
import type { NormalizedSearchResultItem } from "../contracts/types";
import { getDefaultSearchConfig } from "../config/searchConfig";

export interface AlgoliaSearchInterfaceProps {
  config?: OrganizationSearchConfig;
  className?: string;
}

export function AlgoliaSearchInterface({
  config: userConfig,
  className = ""
}: AlgoliaSearchInterfaceProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [layout, setLayout] = useState<"grid" | "list" | "table">("grid");
  const [selectedProduct, setSelectedProduct] =
    useState<NormalizedSearchResultItem | null>(null);

  // Merge default configuration with provided configuration
  const mergedConfig = useMemo(() => {
    const defaults = getDefaultSearchConfig();
    return {
      ...defaults,
      ...userConfig,
      facets: userConfig?.facets || defaults.facets,
      numericFilters: userConfig?.numericFilters || defaults.numericFilters,
      sortOptions: userConfig?.sortOptions || defaults.sortOptions,
      fieldMapping: userConfig?.fieldMapping || defaults.fieldMapping
    };
  }, [userConfig]);

  const algoliaConfig = useMemo(() => resolveAlgoliaConfig(mergedConfig), [mergedConfig]);
  const searchClient = useMemo(
    () => (algoliaConfig ? getOrCreateAlgoliaClient(algoliaConfig) : null),
    [algoliaConfig]
  );

  // Organization-level enable/disable check
  if (!mergedConfig.enabled) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <PageHeader
          title="Algolia Search"
          subtitle="Fast, intelligent search across your catalog."
          breadcrumbs={
            <span className="text-xs font-semibold text-m-text-muted uppercase tracking-widest">
              Commerce
            </span>
          }
        />
        <div className="max-w-xl mx-auto py-16 px-4 text-center">
          <div className="w-14 h-14 rounded-m-2xl bg-m-surface-2 text-m-text-muted mx-auto flex items-center justify-center mb-4 border border-m-border">
            <SearchIcon className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-m-text mb-2">
            Search Capability Unavailable
          </h2>
          <p className="text-xs text-m-text-muted max-w-md mx-auto mb-6">
            Search is currently unavailable for this organization.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-m-lg bg-m-surface-2 text-xs text-m-text-muted font-mono border border-m-border/60">
            <span>Provider: {mergedConfig.provider}</span>
            <span>•</span>
            <span>Status: Disabled</span>
          </div>
        </div>
      </div>
    );
  }

  // Resolve Algolia client & credentials
  if (!algoliaConfig || !searchClient) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <PageHeader
          title="Algolia Search"
          subtitle="Fast, intelligent search across your catalog."
          breadcrumbs={
            <span className="text-xs font-semibold text-m-text-muted uppercase tracking-widest">
              Commerce
            </span>
          }
        />
        <div className="max-w-xl mx-auto py-12 px-4">
          <SearchErrorState message="Search configuration is missing or incomplete for this organization. Please verify your environment credentials." />
        </div>
      </div>
    );
  }

  const capabilityState: SearchCapabilityState = {
    enabled: true,
    providerId: "algolia",
    providerName: "Algolia",
    status: "connected",
    indexName: algoliaConfig.indexName,
    searchMode: "Instant Search"
  };

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`}>
      {/* Standard CSA Page Header */}
      <PageHeader
        title="Algolia Search"
        subtitle="Fast, intelligent search across your catalog."
        breadcrumbs={
          <span className="text-xs font-semibold text-m-text-muted uppercase tracking-widest">
            Commerce
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SearchProviderStatus state={capabilityState} />
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

      <InstantSearch
        searchClient={searchClient as any}
        indexName={algoliaConfig.indexName}
        future={{ preserveSharedStateOnUnmount: true }}
      >
        <div
          className="flex flex-wrap items-center gap-3"
          role="search"
          aria-label="Product search"
        >
          <SearchBox
            placeholder={mergedConfig.placeholder}
            className="min-w-[200px] flex-1"
          />
          <Button
            variant="outline"
            aria-expanded={filtersOpen}
            aria-controls="algolia-filters"
            className="lg:hidden"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <aside
            id="algolia-filters"
            aria-label="Catalog filters"
            className={`${filtersOpen ? "block" : "hidden"} w-full shrink-0 lg:sticky lg:top-6 lg:block lg:w-72 xl:w-80`}
          >
            <SearchFilters
              facets={mergedConfig.facets}
              numericFilters={mergedConfig.numericFilters}
              showSearch={false}
            />
          </aside>
          <section className="w-full min-w-0 flex-1 space-y-5" aria-label="Products">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <SearchStats />
              <SearchSort items={mergedConfig.sortOptions || []} />
            </div>
            <SearchResults
              fieldMapping={mergedConfig.fieldMapping}
              layout={layout}
              onViewDetails={setSelectedProduct}
            />
            <SearchPagination />
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
      </InstantSearch>
    </div>
  );
}
