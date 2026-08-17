export type PagingArgs = {
  limit?: number;
  offset?: number;
  sortKey?: string;
  sortOrder?: string;
};

// Shared pagination bounds for every list/page resolver in this subgraph.
// DEFAULT_PAGE_SIZE mirrors the `limit: Int = 20` defaults declared in the
// commerce contract's GraphQL schema; MAX_PAGE_SIZE caps how much a single
// caller can pull from commercetools in one request.
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;

export function paging(args: PagingArgs = {}) {
  return {
    limit: clamp(args.limit ?? DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE, MAX_PAGE_SIZE),
    offset: Math.max(Math.floor(args.offset ?? 0), 0)
  };
}

export function page<TItem>(results: TItem[], total?: number, offset = 0) {
  return {
    count: results.length,
    offset,
    results,
    total: total ?? results.length
  };
}

export function sort(args: PagingArgs, fallback = "createdAt") {
  const sortKey = args.sortKey?.trim() || fallback;
  const sortOrder = args.sortOrder === "asc" ? "asc" : "desc";

  return [`${sortKey} ${sortOrder}`];
}

export function escapeWhere(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function compactWhere(clauses: Array<string | undefined>) {
  return clauses.filter(Boolean).join(" and ") || undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.floor(value), min), max);
}
