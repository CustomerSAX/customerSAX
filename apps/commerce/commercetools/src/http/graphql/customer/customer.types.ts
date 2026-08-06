import type { PagingArgs } from "../shared/paging.js";

export type CustomerSearchArgs = PagingArgs & {
  excludeGroupId?: string;
  filters?: Record<string, unknown>;
  groupId?: string;
  option?: string;
  text?: string;
};
