import type { PagingArgs } from "../shared/paging.js";

export type CartSearchArgs = PagingArgs & {
  option?: string;
  text: string;
};
