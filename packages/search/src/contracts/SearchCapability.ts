import type {
  SearchFacetConfig,
  SearchFieldMapping,
  SearchNumericFilterConfig,
  SearchSortOption
} from './types';

export type SearchCapabilityStatus =
  | 'loading'
  | 'connected'
  | 'disconnected'
  | 'disabled'
  | 'unavailable'
  | 'error';

export interface OrganizationSearchConfig {
  /** Whether search capability is enabled for this organization */
  enabled: boolean;
  /** Active provider identifier, e.g. "algolia" */
  provider: 'algolia' | string;
  /** Primary index to search */
  indexName?: string;
  /** Application ID for search engine */
  appId?: string;
  /** Public search-only API key (never Admin or Write key) */
  searchApiKey?: string;
  /** User-friendly search box placeholder text */
  placeholder?: string;
  /** Configured facets for filtering */
  facets?: SearchFacetConfig[];
  /** Configured numeric filters */
  numericFilters?: SearchNumericFilterConfig[];
  /** Configured sort/replica options */
  sortOptions?: SearchSortOption[];
  /** Schema field mapping to normalize hit records */
  fieldMapping?: SearchFieldMapping;
}

export interface SearchCapabilityState {
  enabled: boolean;
  providerId: string;
  providerName: string;
  status: SearchCapabilityStatus;
  indexName?: string;
  searchMode: string;
  message?: string;
}

export function isSearchEnabled(config?: OrganizationSearchConfig | null): boolean {
  if (!config) return false;
  return Boolean(config.enabled && config.provider);
}
