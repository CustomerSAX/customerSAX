export interface SearchFacetConfig {
  attribute: string;
  label: string;
  operator?: 'and' | 'or';
  limit?: number;
  showMore?: boolean;
  showMoreLimit?: number;
  searchable?: boolean;
  searchablePlaceholder?: string;
}

export interface SearchNumericFilterConfig {
  attribute: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  currencySymbol?: string;
}

export interface SearchSortOption {
  label: string;
  value: string;
}

export interface SearchFieldMapping {
  id?: string | string[];
  title?: string | string[];
  description?: string | string[];
  sku?: string | string[];
  price?: string | string[];
  pricePerUnit?: string | string[];
  currency?: string | string[];
  imageUrl?: string | string[];
  category?: string | string[];
  brand?: string | string[];
  rating?: string | string[];
  stockStatus?: string | string[];
  inStock?: string | string[];
  tags?: string | string[];
  unitsCount?: string | string[];
  metadata?: string[];
}

export interface SearchItemComponent {
  quantity?: number;
  name?: string;
  region?: string;
  grape?: string;
}

export interface NormalizedSearchResultItem {
  id: string;
  title: string;
  description?: string;
  sku?: string;
  price?: number;
  pricePerUnit?: number;
  currency?: string;
  imageUrl?: string;
  category?: string;
  brand?: string;
  rating?: number;
  stockStatus?: string;
  inStock?: boolean;
  preSale?: boolean;
  lowStock?: boolean;
  unitsCount?: number;
  tags?: string[];
  components?: SearchItemComponent[];
  additionalDetails?: Record<string, string | number | boolean | string[]>;
  raw: Record<string, unknown>;
  _highlightResult?: Record<string, any>;
}

