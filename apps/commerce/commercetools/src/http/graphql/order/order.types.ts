import type { PagingArgs } from "../shared/paging.js";

export type OrderSearchArgs = PagingArgs & {
  businessUnitKey?: string;
  customerEmail?: string;
  customerId?: string;
  option?: string;
  orderRef?: string;
  states?: string[];
  text?: string;
};
