export type GlobalSearchEntity =
  | "customers"
  | "orders"
  | "products"
  | "tickets"
  | "carts"
  | "b2b_companies"
  | "b2b_employees"
  | "b2b_quotes";

export interface GlobalSearchResult {
  id: string;
  entity: GlobalSearchEntity;
  title: string;
  subtitle: string;
  url: string;
  badge?: string;
  badgeVariant?: "success" | "primary" | "warning" | "error" | "neutral";
  imageUrl?: string;
  initials?: string;
}

export interface GlobalSearchGroup {
  entity: GlobalSearchEntity;
  status: "ok" | "error" | "timeout" | "forbidden";
  results: GlobalSearchResult[];
  total?: number;
  error?: string;
}

export interface GlobalSearchResponse {
  query: string;
  groups: GlobalSearchGroup[];
}

