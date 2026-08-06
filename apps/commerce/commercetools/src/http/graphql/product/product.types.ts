import type { PagingArgs } from "../shared/paging.js";

export type ProductSearchArgs = PagingArgs & {
  browse?: boolean;
  currency?: string;
  field?: string;
  locale?: string;
  text?: string;
};
