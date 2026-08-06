export type PagingArgs = {
  limit?: number;
  offset?: number;
  sortKey?: string;
  sortOrder?: string;
};

export function paging(args: PagingArgs = {}) {
  return {
    limit: clamp(args.limit ?? 20, 1, 100),
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
