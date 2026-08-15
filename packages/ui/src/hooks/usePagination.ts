'use client';

import { useMemo, useState } from 'react';

export interface UsePaginationProps {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
  siblingCount?: number;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  canNextPage: boolean;
  canPrevPage: boolean;
  paginationRange: (number | string)[];
}

export function usePagination({
  totalItems,
  pageSize = 10,
  initialPage = 1,
  siblingCount = 1,
}: UsePaginationProps): UsePaginationReturn {
  const [page, setPageInternal] = useState<number>(initialPage);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const setPage = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setPageInternal(clamped);
  };

  const nextPage = () => setPage(page + 1);
  const prevPage = () => setPage(page - 1);

  const canNextPage = page < totalPages;
  const canPrevPage = page > 1;

  const paginationRange = useMemo(() => {
    const totalPageNumbers = siblingCount * 2 + 5;

    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(page - siblingCount, 1);
    const rightSiblingIndex = Math.min(page + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, '...', totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1,
      );
      return [firstPageIndex, '...', ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i,
      );
      return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
    }

    return [];
  }, [siblingCount, page, totalPages]);

  return {
    page,
    pageSize,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    canNextPage,
    canPrevPage,
    paginationRange,
  };
}
