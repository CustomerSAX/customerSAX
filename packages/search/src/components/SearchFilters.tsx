'use client';

import { useState } from 'react';
import {
  useRefinementList,
  useRange,
  useClearRefinements,
  useCurrentRefinements,
  useSearchBox
} from 'react-instantsearch';
import { ChevronDown, ChevronUp, XCircle, RotateCcw } from 'lucide-react';
import { Badge, Button, Accordion } from '@csa/ui';
import type { SearchFacetConfig, SearchNumericFilterConfig } from '../contracts/types';
import { SearchBox } from './SearchBox';

export function ResetSearchButton({ className = '' }: { className?: string }) {
  const { refine: clearRefinements } = useClearRefinements();
  const { clear: clearSearchBox } = useSearchBox();

  const handleReset = () => {
    clearSearchBox();
    clearRefinements();
  };

  return (
    <Button
      variant="outline"
      size="md"
      onClick={handleReset}
      className={`w-full justify-center font-semibold text-xs rounded-m-lg border border-m-border bg-m-surface hover:bg-m-surface-2 transition-colors ${className}`}
    >
      Reset Search
    </Button>
  );
}

export function SelectedRefinements() {
  const { items, refine } = useCurrentRefinements();

  if (items.length === 0) return null;

  return (
    <div className="rounded-m-xl border border-m-border bg-m-surface p-4">
      <h4 className="text-xs font-bold text-m-text mb-3">You&apos;ve selected:</h4>
      <div className="space-y-2">
        {items.flatMap((group) =>
          group.refinements.map((refinement) => (
            <div
              key={`${group.attribute}-${refinement.label}`}
              className="flex items-center justify-between text-xs text-m-primary font-medium hover:text-m-primary/80 group"
            >
              <span className="truncate pr-2">{refinement.label}</span>
              <button
                type="button"
                onClick={() => refine(refinement)}
                className="text-m-text-muted hover:text-m-error p-0.5 rounded-full outline-none transition-colors"
                aria-label={`Remove filter ${refinement.label}`}
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Backwards compatibility alias
export const ActiveRefinementsList = SelectedRefinements;

interface FacetAccordionItemProps {
  config: SearchFacetConfig;
}

function FacetAccordionItem({ config }: FacetAccordionItemProps) {
  const {
    items,
    refine,
    isShowingMore,
    canToggleShowMore,
    toggleShowMore,
    searchForItems
  } = useRefinementList({
    attribute: config.attribute,
    operator: config.operator || 'or',
    limit: config.limit || 8,
    showMore: config.showMore ?? true,
    showMoreLimit: config.showMoreLimit || 20
  });

  const { items: currentRefinements } = useCurrentRefinements();
  const [searchQuery, setSearchQuery] = useState('');

  // Count active refinements for this facet
  const activeCount = currentRefinements
    .filter((group) => group.attribute === config.attribute)
    .reduce((acc, group) => acc + group.refinements.length, 0);

  return (
    <Accordion.Item
      value={config.attribute}
      className="overflow-hidden rounded-m-xl border border-m-border bg-m-surface"
    >
      <Accordion.Trigger className="text-xs font-semibold text-m-text">
        <span className="flex items-center gap-1.5">
          <span>{config.label}</span>
          {activeCount > 0 && (
            <span className="text-xs font-bold text-m-primary">
              ({activeCount})
            </span>
          )}
        </span>
      </Accordion.Trigger>
      <Accordion.Content className="pt-0 px-4 pb-4">
        {config.searchable && (
          <div className="mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchForItems(e.target.value);
              }}
              placeholder={config.searchablePlaceholder || `Filter ${config.label.toLowerCase()}...`}
              className="w-full px-2.5 py-1 text-xs rounded-m-md border border-m-border bg-m-surface-1 text-m-text placeholder:text-m-text-subtle focus:outline-none focus:border-m-primary"
            />
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-xs text-m-text-subtle py-1.5 italic">
            No options available
          </div>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.value}>
                <label className="flex items-center justify-between py-1 px-1.5 rounded-m-md cursor-pointer hover:bg-m-surface-2 transition-colors text-xs select-none">
                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                    <input
                      type="checkbox"
                      checked={item.isRefined}
                      onChange={() => refine(item.value)}
                      className="rounded-m-sm border-m-border text-m-primary focus:ring-m-primary h-3.5 w-3.5"
                    />
                    <span
                      className={`truncate ${
                        item.isRefined ? 'font-bold text-m-text' : 'text-m-text'
                      }`}
                      title={item.label}
                    >
                      {item.label}
                    </span>
                  </div>
                  <Badge
                    variant="neutral"
                    size="sm"
                    className="text-[10px] font-mono px-1.5 py-0 shrink-0"
                  >
                    {item.count}
                  </Badge>
                </label>
              </li>
            ))}
          </ul>
        )}

        {canToggleShowMore && (
          <button
            type="button"
            onClick={toggleShowMore}
            className="mt-2 text-xs text-m-primary hover:underline flex items-center gap-1 font-medium"
          >
            {isShowingMore ? (
              <>
                Show less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Show more <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </Accordion.Content>
    </Accordion.Item>
  );
}

interface NumericRangeAccordionItemProps {
  config: SearchNumericFilterConfig;
}

function NumericRangeAccordionItem({ config }: NumericRangeAccordionItemProps) {
  const { range, refine } = useRange({
    attribute: config.attribute,
    min: config.min,
    max: config.max
  });

  const { items: currentRefinements } = useCurrentRefinements();
  const activeCount = currentRefinements
    .filter((group) => group.attribute === config.attribute)
    .reduce((acc, group) => acc + group.refinements.length, 0);

  const minAvailable = range.min ?? 0;
  const maxAvailable = range.max ?? 1000;

  const [minInput, setMinInput] = useState<string>('');
  const [maxInput, setMaxInput] = useState<string>('');

  const handleApply = () => {
    const minVal = minInput === '' ? undefined : Number(minInput);
    const maxVal = maxInput === '' ? undefined : Number(maxInput);
    refine([minVal, maxVal]);
  };

  const handleReset = () => {
    setMinInput('');
    setMaxInput('');
    refine([undefined, undefined]);
  };

  return (
    <Accordion.Item
      value={config.attribute}
      className="overflow-hidden rounded-m-xl border border-m-border bg-m-surface"
    >
      <Accordion.Trigger className="text-xs font-semibold text-m-text">
        <span className="flex items-center gap-1.5">
          <span>{config.label}</span>
          {activeCount > 0 && (
            <span className="text-xs font-bold text-m-primary">
              ({activeCount})
            </span>
          )}
        </span>
      </Accordion.Trigger>
      <Accordion.Content className="pt-0 px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-m-text-muted">Set price range</span>
          {(minInput !== '' || maxInput !== '') && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-m-text-muted hover:text-m-text"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1.5 text-xs text-m-text-subtle">
              {config.currencySymbol || '$'}
            </span>
            <input
              type="number"
              placeholder={String(Math.floor(minAvailable))}
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              className="w-full pl-6 pr-2 py-1 text-xs rounded-m-md border border-m-border bg-m-surface text-m-text placeholder:text-m-text-subtle focus:outline-none focus:border-m-primary"
            />
          </div>
          <span className="text-m-text-subtle text-xs">-</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1.5 text-xs text-m-text-subtle">
              {config.currencySymbol || '$'}
            </span>
            <input
              type="number"
              placeholder={String(Math.ceil(maxAvailable))}
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              className="w-full pl-6 pr-2 py-1 text-xs rounded-m-md border border-m-border bg-m-surface text-m-text placeholder:text-m-text-subtle focus:outline-none focus:border-m-primary"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleApply}
            className="text-xs px-2.5 py-1 h-auto"
          >
            Go
          </Button>
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

export function ClearFiltersButton() {
  const { canRefine, refine } = useClearRefinements();

  if (!canRefine) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => refine()}
      className="w-full flex items-center justify-center gap-1.5 text-xs"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Clear all filters
    </Button>
  );
}

export interface SearchFiltersProps {
  facets?: SearchFacetConfig[];
  numericFilters?: SearchNumericFilterConfig[];
  placeholder?: string;
  showSearch?: boolean;
  className?: string;
}

export function SearchFilters({
  facets = [],
  numericFilters = [],
  placeholder = 'Search products...',
  showSearch = true,
  className = ''
}: SearchFiltersProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Button: Reset Search */}
      <ResetSearchButton />

      {/* Multiple-Open Accordion for Search and Facets */}
      <Accordion
        type="multiple"
        defaultValue={['search']}
        className="space-y-3 divide-y-0 rounded-none border-none bg-transparent"
      >
        {/* Collapsible Search Accordion */}
        {showSearch && <Accordion.Item
          value="search"
          className="overflow-hidden rounded-m-xl border border-m-border bg-m-surface"
        >
          <Accordion.Trigger className="text-xs font-semibold text-m-text">
            Search
          </Accordion.Trigger>
          <Accordion.Content className="pt-0 px-4 pb-4">
            <SearchBox placeholder={placeholder} />
          </Accordion.Content>
        </Accordion.Item>}

        {/* Selected Refinements ("You've selected:") */}
        <SelectedRefinements />

        {/* Facet Accordion Sections */}
        {facets.map((facet) => (
          <FacetAccordionItem key={facet.attribute} config={facet} />
        ))}

        {/* Numeric Filter Accordion Sections */}
        {numericFilters.map((numFilter) => (
          <NumericRangeAccordionItem key={numFilter.attribute} config={numFilter} />
        ))}
      </Accordion>
    </div>
  );
}

