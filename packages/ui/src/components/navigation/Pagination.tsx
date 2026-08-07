'use client';

import { cn } from '../../utils';
import { Button } from '../../primitives/Button';
import { Icon } from '../../icons/Icon';
import { usePagination } from '../../hooks/usePagination';

export interface PaginationProps {
  totalItems: number;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function Pagination({
  totalItems,
  pageSize = 10,
  currentPage = 1,
  onPageChange,
  className,
}: PaginationProps) {
  const { page, setPage, nextPage, prevPage, canNextPage, canPrevPage, paginationRange } =
    usePagination({
      totalItems,
      pageSize,
      initialPage: currentPage,
    });

  const handlePageSelect = (p: number) => {
    setPage(p);
    onPageChange?.(p);
  };

  return (
    <nav aria-label="Pagination Navigation" className={cn('flex items-center gap-1 select-none', className)}>
      <Button
        variant="outline"
        size="sm"
        disabled={!canPrevPage}
        onClick={() => {
          prevPage();
          onPageChange?.(page - 1);
        }}
        iconOnly
        leftIcon={<Icon name="chevron-left" size="xs" />}
        aria-label="Previous page"
      />

      {paginationRange.map((pageNumber, idx) => {
        if (typeof pageNumber === 'string') {
          return (
            <span key={idx} className="px-2 text-xs text-m-text-muted select-none">
              ...
            </span>
          );
        }

        const isSelected = pageNumber === page;
        return (
          <Button
            key={idx}
            variant={isSelected ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handlePageSelect(pageNumber)}
            className="w-8 h-8 p-0 text-xs font-semibold"
          >
            {pageNumber}
          </Button>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        disabled={!canNextPage}
        onClick={() => {
          nextPage();
          onPageChange?.(page + 1);
        }}
        iconOnly
        leftIcon={<Icon name="chevron-right" size="xs" />}
        aria-label="Next page"
      />
    </nav>
  );
}
