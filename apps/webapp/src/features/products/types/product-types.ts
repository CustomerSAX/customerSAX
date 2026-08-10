/**
 * Product Module Types
 *
 * Strongly-typed interfaces for the Product Directory and Product Detail views.
 * These match the rich JSON shape returned by the BFF productSearch / productDetail queries.
 */

// ---------------------------------------------------------------------------
// Money / Price
// ---------------------------------------------------------------------------

export interface CtMoneyValue {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
}

export interface CtPrice {
  value: CtMoneyValue;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export interface CtChannelAvailabilityEntry {
  availability?: {
    isOnStock?: boolean;
    availableQuantity?: number;
  };
}

export interface CtVariantAvailability {
  noChannel?: {
    isOnStock?: boolean;
    availableQuantity?: number;
  } | null;
  channels?: {
    results?: CtChannelAvailabilityEntry[];
  } | null;
}

// ---------------------------------------------------------------------------
// Raw CT shape (from productSearch / productDetail Json! responses)
// ---------------------------------------------------------------------------

export interface CtLocalizedString {
  locale?: string;
  value: string;
}

export interface CtRawVariant {
  id?: number | string;
  sku?: string;
  key?: string;
  images?: Array<{ url?: string }>;
  prices?: CtPrice[];
  availability?: CtVariantAvailability;
}

export interface CtRawProduct {
  id: string;
  key?: string | null;
  createdAt?: string;
  lastModifiedAt?: string;
  priceMode?: string;
  taxCategory?: { name?: string } | null;
  productType?: { name?: string } | null;
  masterData?: {
    hasStagedChanges?: boolean;
    current?: {
      nameAllLocales?: CtLocalizedString[];
      descriptionAllLocales?: CtLocalizedString[];
      slugAllLocales?: CtLocalizedString[];
      categories?: CtRawCategory[];
      masterVariant?: CtRawVariant;
      allVariants?: CtRawVariant[];
    } | null;
  } | null;
}

export interface CtRawCategory {
  id?: string;
  nameAllLocales?: CtLocalizedString[];
  ancestors?: Array<{
    id?: string;
    nameAllLocales?: CtLocalizedString[];
  }>;
}

// ---------------------------------------------------------------------------
// Normalized row shapes (after mapping)
// ---------------------------------------------------------------------------

/** One variant row in the Product List expand sub-table */
export interface ProductVariantRow {
  id: string;
  sku: string;
  key: string;
}

/** One row in the Product List table */
export interface ProductListRow {
  id: string;
  itemName: string;
  productType: string;
  key: string;
  sku: string;
  price: string;
  availability: string;
  description: string;
  categories: string;
  status: string;
  created: string;
  modified: string;
  variants: ProductVariantRow[];
  variantCount: number;
}

/** One variant row in the Product Detail table */
export interface VariantDetailRow {
  id: string;
  sku: string;
  key: string;
  /** First image URL or empty string */
  imageUrl: string;
  unitPrice: string;
  quantity: string;
}

/** Normalized product detail */
export interface ProductDetail {
  id: string;
  key: string;
  productName: string;
  productDescription: string;
  priceMode: string;
  taxCategory: string;
  categories: CategoryBreadcrumb[];
  variants: VariantDetailRow[];
}

/** A single category with resolved name and ancestors for breadcrumb rendering */
export interface CategoryBreadcrumb {
  id: string;
  name: string;
  /** Ancestor names from root → parent (not including self) */
  ancestors: string[];
}

// ---------------------------------------------------------------------------
// Search / sort / pagination state
// ---------------------------------------------------------------------------

export type ProductSortKey = "itemName" | "key" | "created" | "modified";
export type SortOrder = "asc" | "desc";

export interface ProductSort {
  key: ProductSortKey;
  order: SortOrder;
}

export interface ProductSearch {
  text: string;
  option: ProductSearchField;
}

export type ProductSearchField =
  | "allFields"
  | "name"
  | "description"
  | "key"
  | "variants.sku";

// ---------------------------------------------------------------------------
// Column management (DataTableManager)
// ---------------------------------------------------------------------------

export interface ProductColumn {
  key: string;
  label: string;
}

export interface TableSettings {
  visibleColumnKeys: string[];
  isCondensed: boolean;
  isWrappingText: boolean;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface ProductSearchResponse {
  results: CtRawProduct[];
  total: number;
  count?: number;
  offset?: number;
}

export interface StandalonePriceResult {
  sku?: string;
  value?: CtMoneyValue;
}

export interface StandalonePricesResponse {
  standalonePrices?: {
    results?: StandalonePriceResult[];
  };
}
