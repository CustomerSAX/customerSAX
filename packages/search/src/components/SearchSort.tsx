'use client';

import { useSortBy } from 'react-instantsearch';
import type { SearchSortOption } from '../contracts/types';

export interface SearchSortProps {
  items?: SearchSortOption[];
  className?: string;
}

function ActiveSortBy({ items, className }: { items: SearchSortOption[]; className?: string }) {
  const { currentRefinement, options, refine } = useSortBy({ items });

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor="search-sort-select"
        className="text-xs font-medium text-m-text-muted shrink-0"
      >
        Sort
      </label>
      <select
        id="search-sort-select"
        value={currentRefinement}
        onChange={(e) => refine(e.target.value)}
        className="text-xs rounded-m-lg border border-m-border bg-m-surface text-m-text py-1.5 px-3 outline-none focus:border-m-primary cursor-pointer hover:border-m-border-strong transition-colors"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SearchSort({ items = [], className = '' }: SearchSortProps) {
  if (items.length > 1) {
    return <ActiveSortBy items={items} className={className} />;
  }

  // Structural fallback when no replica indices are configured
  const defaultLabel = items[0]?.label || 'Name (A–Z)';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor="search-sort-static"
        className="text-xs font-medium text-m-text-muted shrink-0"
      >
        Sort
      </label>
      <select
        id="search-sort-static"
        defaultValue="default"
        className="text-xs rounded-m-lg border border-m-border bg-m-surface text-m-text py-1.5 px-3 outline-none focus:border-m-primary cursor-pointer hover:border-m-border-strong transition-colors"
      >
        <option value="default">{defaultLabel}</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
      </select>
    </div>
  );
}

