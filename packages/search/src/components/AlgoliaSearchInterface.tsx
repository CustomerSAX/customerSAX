'use client';

import { useMemo, useState } from 'react';
import { InstantSearch } from 'react-instantsearch';
import {
  Button,
  Drawer,
  DrawerHeader,
  DrawerContent,
  PageHeader
} from '@csa/ui';
import { SlidersHorizontal, Search as SearchIcon } from 'lucide-react';
import type { OrganizationSearchConfig, SearchCapabilityState } from '../contracts/SearchCapability';
import { SearchBox } from './SearchBox';
import { SearchFilters } from './SearchFilters';
import { SearchSort } from './SearchSort';
import { SearchResults } from './SearchResults';
import { SearchPagination } from './SearchPagination';
import { SearchStats } from './SearchStats';
import { SearchProviderStatus } from './SearchProviderStatus';
import { SearchErrorState } from './SearchErrorState';
import { getOrCreateAlgoliaClient } from '../providers/algolia/algoliaClient';
import { resolveAlgoliaConfig } from '../providers/algolia/configuration';
import { getDefaultSearchConfig } from '../config/searchConfig';

export interface AlgoliaSearchInterfaceProps {
  config?: OrganizationSearchConfig;
  className?: string;
}

export function AlgoliaSearchInterface({
  config: userConfig,
  className = ''
}: AlgoliaSearchInterfaceProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
  const algoliaConfig = resolveAlgoliaConfig(mergedConfig);

  if (!algoliaConfig) {
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

  const searchClient = useMemo(() => {
    return getOrCreateAlgoliaClient(algoliaConfig);
  }, [algoliaConfig]);

  const capabilityState: SearchCapabilityState = {
    enabled: true,
    providerId: 'algolia',
    providerName: 'Algolia',
    status: 'connected',
    indexName: algoliaConfig.indexName,
    searchMode: 'Instant Search'
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
        actions={<SearchProviderStatus state={capabilityState} />}
      />

      <InstantSearch
        searchClient={searchClient as any}
        indexName={algoliaConfig.indexName}
        future={{ preserveSharedStateOnUnmount: true }}
      >
        {/* Mobile Filter & Search Bar (< lg) */}
        <div className="lg:hidden flex items-center justify-between gap-3 bg-m-surface rounded-m-xl border border-m-border p-3.5 shadow-m-xs">
          <div className="flex-1">
            <SearchBox placeholder={mergedConfig.placeholder} />
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex items-center gap-1.5 rounded-m-lg text-xs font-semibold shrink-0"
            aria-label="Open filter drawer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </Button>
        </div>

        {/* Responsive Two-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Desktop Left Sidebar: Reset, Search Box, You've Selected, Facet Accordions */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 hidden lg:block sticky top-6">
            <SearchFilters
              facets={mergedConfig.facets}
              numericFilters={mergedConfig.numericFilters}
              placeholder={mergedConfig.placeholder}
            />
          </aside>

          {/* Right Main Content Area */}
          <main className="flex-1 w-full min-w-0 space-y-4">
            {/* Results Sub-Header: Product Count (Left) & Sort Selector (Right) */}
            <div className="flex items-center justify-between gap-4 py-1">
              <SearchStats />
              <SearchSort items={mergedConfig.sortOptions || []} />
            </div>

            {/* Vertically Stacked Full-Width Product Result Cards */}
            <SearchResults fieldMapping={mergedConfig.fieldMapping} />

            {/* Pagination Controls */}
            <SearchPagination />
          </main>
        </div>

        {/* Mobile Filter Drawer */}
        <Drawer
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          position="right"
          size="md"
          aria-label="Filter catalog"
        >
          <DrawerHeader
            title="Search & Filters"
            subtitle="Refine catalog results"
            onClose={() => setMobileFiltersOpen(false)}
          />
          <DrawerContent className="p-5">
            <SearchFilters
              facets={mergedConfig.facets}
              numericFilters={mergedConfig.numericFilters}
              placeholder={mergedConfig.placeholder}
            />
            <div className="pt-4 mt-4 border-t border-m-border">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full text-xs"
              >
                Apply Filters
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </InstantSearch>
    </div>
  );
}
