import type { PagingArgs } from "../shared/paging.js";

import type { CatalogFilters } from "./product.filters.js";

export type ProductSearchArgs = PagingArgs & {
  filters?: CatalogFilters;
  includeFacets?: boolean;
  browse?: boolean;
  currency?: string;
  field?: string;
  locale?: string;
  text?: string;
};
