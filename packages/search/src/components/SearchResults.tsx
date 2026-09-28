'use client';

import { useHits, useInstantSearch } from 'react-instantsearch';
import { Skeleton } from '@csa/ui';
import { SearchResultCard } from './SearchResultCard';
import { SearchEmptyState } from './SearchEmptyState';
import { SearchErrorState } from './SearchErrorState';
import { normalizeSearchResultItem } from '../config/searchConfig';
import type { NormalizedSearchResultItem, SearchFieldMapping } from '../contracts/types';

export interface SearchResultsProps {
  fieldMapping?: SearchFieldMapping;
  className?: string;
  onResetFilters?: () => void;
  onViewDetails?: (item: NormalizedSearchResultItem) => void;
}

export function SearchResults({
  fieldMapping,
  className = '',
  onResetFilters,
  onViewDetails
}: SearchResultsProps) {
  const { hits } = useHits();
  const { status, error, refresh } = useInstantSearch();

  const isLoading = status === 'loading' && hits.length === 0;

  if (error) {
    return (
      <SearchErrorState
        message="Unable to load search results. Please check your connection and try again."
        onRetry={() => refresh()}
        className={className}
      />
    );
  }

  if (isLoading) {
    return (
      <div
        className={`flex flex-col gap-4 w-full ${className}`}
        aria-busy="true"
        aria-label="Loading results"
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 rounded-m-xl border border-m-border bg-m-surface flex flex-col sm:flex-row gap-5 items-start"
          >
            <Skeleton className="h-28 w-14 rounded-m-md shrink-0 self-center sm:self-start" />
            <div className="flex-1 w-full space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1.5 w-1/2">
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-3.5 w-40 rounded" />
                </div>
                <div className="space-y-2 flex flex-col items-end">
                  <Skeleton className="h-4 w-28 rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-12 rounded" />
                    <Skeleton className="h-8 w-24 rounded" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-20 w-full rounded-m-lg mt-3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (hits.length === 0) {
    return <SearchEmptyState onReset={onResetFilters} className={className} />;
  }

  return (
    <div
      role="region"
      aria-label="Search results"
      className={`flex flex-col gap-4 w-full ${className}`}
    >
      {hits.map((hit) => {
        const normalized = normalizeSearchResultItem(
          hit as Record<string, unknown>,
          fieldMapping
        );
        return (
          <SearchResultCard
            key={normalized.id || (hit.objectID as string)}
            item={normalized}
            onViewDetails={onViewDetails}
          />
        );
      })}
    </div>
  );
}

