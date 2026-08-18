'use client';

import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface UseDataTableOptions<T, K extends keyof T> {
  rows: T[];
  initialSortKey: K;
  initialSortDirection?: SortDirection;
  newSortDirection?: SortDirection;
  pageSize?: number;
  getSortValue?: (row: T, key: K) => unknown;
}

export function useDataTable<T, K extends keyof T>({
  rows,
  initialSortKey,
  initialSortDirection = 'asc',
  newSortDirection = 'asc',
  pageSize = 10,
  getSortValue,
}: UseDataTableOptions<T, K>) {
  const [sortKey, setSortKey] = useState<K>(initialSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);
  const [page, setPage] = useState(1);

  const handleSort = (key: K) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(newSortDirection);
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aValue = getSortValue ? getSortValue(a, sortKey) : a[sortKey];
      const bValue = getSortValue ? getSortValue(b, sortKey) : b[sortKey];
      const comparison = compareSortValues(aValue, bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [getSortValue, rows, sortDirection, sortKey]);

  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedRows]);

  return {
    page: currentPage,
    pageSize,
    paginatedRows,
    resetPage: () => setPage(1),
    setPage,
    sortDirection,
    sortKey,
    sortedRows,
    totalItems,
    totalPages,
    onSort: handleSort,
  };
}

function compareSortValues(aValue: unknown, bValue: unknown) {
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return -1;
  if (bValue == null) return 1;

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return aValue - bValue;
  }

  if (aValue instanceof Date && bValue instanceof Date) {
    return aValue.getTime() - bValue.getTime();
  }

  return String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
}
