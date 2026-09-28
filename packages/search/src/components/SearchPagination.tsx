'use client';

import { usePagination } from 'react-instantsearch';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SearchPaginationProps {
  className?: string;
  padding?: number;
}

export function SearchPagination({
  className = '',
  padding = 2
}: SearchPaginationProps) {
  const {
    pages,
    currentRefinement,
    nbPages,
    isFirstPage,
    isLastPage,
    refine,
    canRefine
  } = usePagination({ padding });

  if (!canRefine || nbPages <= 1) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label="Search results pagination"
      className={`flex items-center justify-center gap-1.5 py-4 ${className}`}
    >
      <button
        type="button"
        disabled={isFirstPage}
        onClick={() => refine(currentRefinement - 1)}
        aria-label="Previous page"
        className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4 mr-0.5" />
        Prev
      </button>

      {pages.map((page) => {
        const isCurrent = page === currentRefinement;
        return (
          <button
            key={page}
            type="button"
            onClick={() => refine(page)}
            aria-current={isCurrent ? 'page' : undefined}
            aria-label={`Page ${page + 1}`}
            className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors ${
              isCurrent
                ? 'bg-primary-600 text-white shadow-sm font-semibold'
                : 'border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            {page + 1}
          </button>
        );
      })}

      <button
        type="button"
        disabled={isLastPage}
        onClick={() => refine(currentRefinement + 1)}
        aria-label="Next page"
        className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <ChevronRight className="w-4 h-4 ml-0.5" />
      </button>
    </nav>
  );
}
