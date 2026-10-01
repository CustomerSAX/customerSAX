"use client";

import { useMemo } from "react";
import {
  InstantSearch,
  useHits,
  useInstantSearch,
  useClearRefinements,
  useSearchBox
} from "react-instantsearch";
import { CatalogView } from "./CatalogView";
import { SearchBox } from "./SearchBox";
import { DynamicSearchFilters } from "./DynamicSearchFilters";
import { SearchSort } from "./SearchSort";
import { SearchPagination } from "./SearchPagination";
import { SearchStats } from "./SearchStats";
import { getOrCreateAlgoliaClient } from "../providers/algolia/algoliaClient";
import { resolveAlgoliaConfig } from "../providers/algolia/configuration";
import {
  getDefaultSearchConfig,
  normalizeSearchResultItem
} from "../config/searchConfig";
import { catalogStateMapping } from "../config/catalogRouting";
import type { OrganizationSearchConfig } from "../contracts/SearchCapability";

export interface AlgoliaSearchInterfaceProps {
  config?: OrganizationSearchConfig;
  className?: string;
}

function AlgoliaCatalogAdapter({ config }: { config: OrganizationSearchConfig }) {
  const { hits, results } = useHits();
  const { status, error, refresh } = useInstantSearch();
  const { refine: clearFilters } = useClearRefinements();
  const { clear: clearSearch } = useSearchBox();
  const loading =
    status === "loading" || status === "stalled" || !results || results.__isArtificial;
  return (
    <CatalogView
      provider={{
        enabled: true,
        providerId: "algolia",
        providerName: "Algolia",
        status: error ? "error" : loading ? "loading" : "connected",
        indexName: config.indexName,
        searchMode: "Instant Search"
      }}
      items={hits.map((hit) =>
        normalizeSearchResultItem(hit as Record<string, unknown>, config.fieldMapping)
      )}
      loading={loading && hits.length === 0}
      error={error?.message}
      onRetry={refresh}
      onReset={() => {
        clearFilters();
        clearSearch();
      }}
      search={<SearchBox placeholder={config.placeholder} />}
      filters={
        <DynamicSearchFilters />
      }
      stats={<SearchStats />}
      sort={<SearchSort items={config.sortOptions || []} />}
      pagination={<SearchPagination />}
    />
  );
}

export function AlgoliaSearchInterface({
  config: userConfig,
  className = ""
}: AlgoliaSearchInterfaceProps) {
  const config = useMemo(
    () => ({ ...getDefaultSearchConfig(), ...userConfig }),
    [userConfig]
  );
  const credentials = useMemo(() => resolveAlgoliaConfig(config), [config]);
  const client = useMemo(
    () => (credentials ? getOrCreateAlgoliaClient(credentials) : null),
    [credentials]
  );
  const routing = useMemo(
    () => ({ stateMapping: catalogStateMapping(credentials?.indexName || "products") }),
    [credentials?.indexName]
  );
  if (!config.enabled || !credentials || !client)
    return (
      <CatalogView
        provider={{
          enabled: false,
          providerId: "algolia",
          providerName: "Algolia",
          status: "disabled",
          searchMode: "Instant Search"
        }}
        items={[]}
        error="Algolia is not configured. Set the application ID, search-only API key, and index name in Studio's environment."
      />
    );
  return (
    <div className={className}>
      <InstantSearch
        searchClient={client}
        indexName={credentials.indexName}
        routing={routing}
        future={{ preserveSharedStateOnUnmount: true }}
      >
        <AlgoliaCatalogAdapter config={config} />
      </InstantSearch>
    </div>
  );
}
