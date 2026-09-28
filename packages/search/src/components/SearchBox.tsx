'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSearchBox, useInstantSearch } from 'react-instantsearch';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchBoxProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBox({
  placeholder = 'Search products by name, style, variety, region, or SKU...',
  className = '',
  autoFocus = false
}: SearchBoxProps) {
  const { query, refine, clear } = useSearchBox();
  const { status } = useInstantSearch();
  const [inputValue, setInputValue] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearching = status === 'loading' || status === 'stalled';

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    refine(val);
  };

  const handleClear = () => {
    setInputValue('');
    clear();
    inputRef.current?.focus();
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative flex items-center w-full">
        <span
          className="pointer-events-none absolute left-3.5 flex items-center justify-center text-m-text-muted z-10"
          aria-hidden="true"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin text-m-primary" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </span>

        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label="Search catalog"
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm rounded-m-lg border border-m-border bg-m-surface text-m-text placeholder:text-m-text-subtle shadow-m-xs outline-none hover:border-m-border-strong focus:border-m-primary focus:ring-2 focus:ring-m-primary/20 transition-all"
        />

        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search input"
            className="absolute right-3 p-1 rounded-full text-m-text-muted hover:text-m-text hover:bg-m-surface-2 transition-colors outline-none z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
