'use client';

import { Input } from '@csa/ui';
import { useCustomerSearch, type CustomerSearchResult } from './useCustomerSearch';

export interface CustomerResultListProps {
  search: string;
  setSearch: (v: string) => void;
  onSelect: (c: CustomerSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  emptyBeforeTyping?: string;
  noMatches?: (query: string) => string;
}

/**
 * Shared search input + result list for "who is this for?" steps — search
 * input, loading state, empty state, no-matches state, and result rows.
 */
export function CustomerResultList({
  search,
  setSearch,
  onSelect,
  placeholder = 'Search customers by name or email...',
  autoFocus,
  emptyBeforeTyping = 'Type a name or email to search...',
  noMatches = (q) => `No customers found matching "${q}".`,
}: CustomerResultListProps) {
  const { results, isLoading, error } = useCustomerSearch(search);

  return (
    <>
      <div className="opt-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Input
          className="search-input"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus={autoFocus}
        />
      </div>

      {isLoading ? (
        <div className="opt-empty-state">Searching customers...</div>
      ) : error ? (
        <div className="opt-empty-state opt-error-state">⚠ {error}</div>
      ) : search.trim() === '' ? (
        <div className="opt-empty-state">{emptyBeforeTyping}</div>
      ) : results.length === 0 ? (
        <div className="opt-empty-state">{noMatches(search)}</div>
      ) : (
        results.map((c) => (
          <div key={c.id} className="opt-card" onClick={() => onSelect(c)}>
            <div className="opt-avatar">{c.initials}</div>
            <div className="opt-main">
              <div className="opt-name">{c.name}</div>
              <div className="opt-sub">{c.email}</div>
            </div>
            <div className="opt-chevron">&rsaquo;</div>
          </div>
        ))
      )}
    </>
  );
}
