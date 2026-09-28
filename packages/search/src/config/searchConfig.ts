import type {
  OrganizationSearchConfig
} from '../contracts/SearchCapability';
import type {
  NormalizedSearchResultItem,
  SearchFacetConfig,
  SearchFieldMapping,
  SearchNumericFilterConfig
} from '../contracts/types';
import { getAlgoliaConfigFromEnv } from '../providers/algolia/configuration';

export const DEFAULT_FACETS: SearchFacetConfig[] = [
  {
    attribute: 'searchType',
    label: 'Search Type',
    operator: 'or',
    limit: 10,
    showMore: true
  },
  {
    attribute: 'productType',
    label: 'Product Type',
    operator: 'or',
    limit: 10,
    showMore: true
  },
  {
    attribute: 'wineStyle',
    label: 'Wine Style',
    operator: 'or',
    limit: 10,
    showMore: true
  },
  {
    attribute: 'grapes',
    label: 'Grape',
    operator: 'or',
    limit: 10,
    showMore: true,
    searchable: true,
    searchablePlaceholder: 'Search grapes...'
  },
  {
    attribute: 'country',
    label: 'Country',
    operator: 'or',
    limit: 10,
    showMore: true,
    searchable: true,
    searchablePlaceholder: 'Search countries...'
  },
  {
    attribute: 'region',
    label: 'Region',
    operator: 'or',
    limit: 10,
    showMore: true,
    searchable: true,
    searchablePlaceholder: 'Search regions...'
  },
  {
    attribute: 'vppItem',
    label: 'VPP Items',
    operator: 'or',
    limit: 10,
    showMore: false
  },
  {
    attribute: 'memberOffer',
    label: 'Member Offers',
    operator: 'or',
    limit: 10,
    showMore: false
  },
  {
    attribute: 'saleable',
    label: 'Show Only',
    operator: 'or',
    limit: 10,
    showMore: false
  },
  {
    attribute: 'salesActivity',
    label: 'Sales Activity',
    operator: 'or',
    limit: 10,
    showMore: true
  },
  {
    attribute: 'stockStatus',
    label: 'Stock Status',
    operator: 'or',
    limit: 10,
    showMore: false
  }
];

export const DEFAULT_NUMERIC_FILTERS: SearchNumericFilterConfig[] = [
  {
    attribute: 'price',
    label: 'Price Range',
    currencySymbol: '$'
  }
];

export const DEFAULT_FIELD_MAPPING: SearchFieldMapping = {
  id: ['sku', 'id', 'objectID', '_id'],
  title: ['name', 'title', 'productName', 'label'],
  description: ['description', 'summary', 'details', 'wineStyle'],
  sku: ['sku', 'productCode', 'itemNumber', 'objectID'],
  price: ['price', 'amount', 'unitPrice', 'salePrice'],
  pricePerUnit: ['pricePerBottle', 'pricePerUnit', 'unitPrice'],
  currency: ['currency', 'priceCurrency'],
  category: ['productType', 'category', 'department', 'type'],
  brand: ['brand', 'producer', 'winery', 'vendor'],
  rating: ['rating', 'score', 'stars'],
  stockStatus: ['stockStatus', 'availability', 'status'],
  inStock: ['saleable', 'inStock', 'isAvailable'],
  unitsCount: ['bottles', 'quantity', 'packSize'],
  tags: ['wineStyle', 'grapes', 'tags', 'salesActivity', 'keywords']
};

export function getDefaultSearchConfig(): OrganizationSearchConfig {
  const envConfig = getAlgoliaConfigFromEnv();

  return {
    enabled: Boolean(envConfig),
    provider: 'algolia',
    appId: envConfig?.appId || '',
    searchApiKey: envConfig?.searchApiKey || '',
    indexName: envConfig?.indexName || '',
    placeholder: 'Search products...',
    facets: DEFAULT_FACETS,
    numericFilters: DEFAULT_NUMERIC_FILTERS,
    sortOptions: [
      { label: 'Name (A–Z)', value: envConfig?.indexName || 'default' }
    ],
    fieldMapping: DEFAULT_FIELD_MAPPING
  };
}

function resolveFieldValue<T = unknown>(
  obj: Record<string, unknown>,
  candidates?: string | string[]
): T | undefined {
  if (!candidates) return undefined;
  const list = Array.isArray(candidates) ? candidates : [candidates];
  for (const field of list) {
    if (obj[field] !== undefined && obj[field] !== null && obj[field] !== '') {
      return obj[field] as T;
    }
  }
  return undefined;
}

export function normalizeSearchResultItem(
  hit: Record<string, unknown>,
  mapping: SearchFieldMapping = DEFAULT_FIELD_MAPPING
): NormalizedSearchResultItem {
  const id =
    resolveFieldValue<string>(hit, mapping.id) ||
    (hit.objectID as string) ||
    '';

  const title =
    resolveFieldValue<string>(hit, mapping.title) ||
    id ||
    'Untitled Item';

  const description = resolveFieldValue<string>(hit, mapping.description);
  const sku = resolveFieldValue<string>(hit, mapping.sku);
  const price = resolveFieldValue<number>(hit, mapping.price);
  const pricePerUnit = resolveFieldValue<number>(hit, mapping.pricePerUnit);
  const currency = resolveFieldValue<string>(hit, mapping.currency) || 'USD';
  const imageUrl = resolveFieldValue<string>(hit, mapping.imageUrl);
  const category = resolveFieldValue<string>(hit, mapping.category);
  const brand = resolveFieldValue<string>(hit, mapping.brand);
  const rating = resolveFieldValue<number>(hit, mapping.rating);
  const stockStatus = resolveFieldValue<string>(hit, mapping.stockStatus);
  const inStock = resolveFieldValue<boolean>(hit, mapping.inStock);
  const preSale = Boolean(hit.preSale);
  const lowStock = Boolean(hit.lowStock);
  const unitsCount =
    resolveFieldValue<number>(hit, mapping.unitsCount) ??
    (typeof hit.bottles === 'number' ? hit.bottles : undefined);

  // Extract components list if available
  let components = undefined;
  if (Array.isArray(hit.components)) {
    components = hit.components.map((c: any) => ({
      quantity: typeof c.quantity === 'number' ? c.quantity : typeof c.qty === 'number' ? c.qty : 1,
      name: String(c.name || c.title || ''),
      region: String(c.region || ''),
      grape: String(c.grape || c.varietal || c.style || '')
    }));
  }

  // Extract tags from array or string fields
  let tags: string[] = [];
  const rawTags = resolveFieldValue<unknown>(hit, mapping.tags);
  if (Array.isArray(rawTags)) {
    tags = rawTags.map(String);
  } else if (typeof rawTags === 'string') {
    tags = [rawTags];
  }

  // Collect other details for display
  const excludeKeys = new Set([
    '_highlightResult',
    '_snippetResult',
    'objectID',
    'name',
    'title',
    'price',
    'currency',
    'sku',
    'description',
    'components',
    'offers'
  ]);

  const additionalDetails: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(hit)) {
    if (excludeKeys.has(key)) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      (Array.isArray(value) && value.every((v) => typeof v === 'string'))
    ) {
      additionalDetails[key] = value as string | number | boolean | string[];
    }
  }

  return {
    id,
    title,
    description: typeof description === 'string' ? description : undefined,
    sku,
    price: typeof price === 'number' ? price : undefined,
    pricePerUnit: typeof pricePerUnit === 'number' ? pricePerUnit : undefined,
    currency,
    imageUrl,
    category,
    brand,
    rating: typeof rating === 'number' ? rating : undefined,
    stockStatus,
    inStock,
    preSale,
    lowStock,
    unitsCount: typeof unitsCount === 'number' ? unitsCount : undefined,
    tags: tags.length > 0 ? tags : undefined,
    components,
    additionalDetails,
    raw: hit,
    _highlightResult: hit._highlightResult as Record<string, any> | undefined
  };
}
