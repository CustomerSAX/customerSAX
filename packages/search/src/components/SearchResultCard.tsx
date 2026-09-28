'use client';

import { Highlight } from 'react-instantsearch';
import { Badge, Button } from '@csa/ui';
import { Star } from 'lucide-react';
import type { NormalizedSearchResultItem, SearchItemComponent } from '../contracts/types';

export interface SearchResultCardProps {
  item: NormalizedSearchResultItem;
  className?: string;
  onViewDetails?: (item: NormalizedSearchResultItem) => void;
}

function WineBottleGraphic({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-24 sm:h-28 w-auto object-contain ${className}`}
      aria-hidden="true"
    >
      {/* Foil / Capsule */}
      <rect x="16" y="6" width="8" height="6" rx="1" fill="#881337" />
      <rect x="17" y="12" width="6" height="20" fill="#9F1239" />
      {/* Body */}
      <path
        d="M17 32C17 42 11 48 11 56V132C11 134 13 136 15 136H25C27 136 29 134 29 132V56C29 48 23 42 23 32H17Z"
        fill="#1C3829"
      />
      {/* Highlight reflection */}
      <path
        d="M14 60V126C14 128 15 129 16 129H17V58C17 54 18 50 19 46L18 43C16 48 14 54 14 60Z"
        fill="white"
        fillOpacity="0.18"
      />
      {/* Label */}
      <rect x="13" y="68" width="14" height="34" rx="1" fill="#FDFBF7" />
      <line x1="15" y1="76" x2="25" y2="76" stroke="#78350F" strokeWidth="0.8" />
      <line x1="16" y1="81" x2="24" y2="81" stroke="#9CA3AF" strokeWidth="0.6" />
      <line x1="17" y1="85" x2="23" y2="85" stroke="#9CA3AF" strokeWidth="0.6" />
    </svg>
  );
}

function RatingStars({ rating = 0 }: { rating?: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rounded
              ? 'fill-amber-400 text-amber-400'
              : 'fill-neutral-200 text-neutral-300 dark:fill-neutral-700 dark:text-neutral-600'
          }`}
        />
      ))}
    </div>
  );
}

export function SearchResultCard({ item, className = '', onViewDetails }: SearchResultCardProps) {
  const formatCurrency = (amount?: number, currency = 'USD') => {
    if (amount === undefined || amount === null) return null;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  const titleAttr: string | null = item.raw.name ? 'name' : item.raw.title ? 'title' : null;

  // Resolve subtitle (e.g. "International | Mixed wine")
  const origin = Array.isArray(item.raw.country)
    ? item.raw.country.join(', ')
    : (item.raw.country as string) ||
      (Array.isArray(item.raw.region)
        ? item.raw.region.join(', ')
        : (item.raw.region as string));

  const style = Array.isArray(item.raw.wineStyle)
    ? item.raw.wineStyle.join(', ')
    : (item.raw.wineStyle as string) || item.category;

  const subtitle = [origin, style].filter(Boolean).join(' | ');

  // Resolve components list
  const hasExplicitComponents = Boolean(item.components && item.components.length > 0);
  const displayComponents: SearchItemComponent[] = hasExplicitComponents
    ? (item.components as SearchItemComponent[])
    : [
        {
          quantity: item.unitsCount || 1,
          name: item.title,
          region: origin || '—',
          grape: style || '—'
        }
      ];

  const isOutOfStock = item.stockStatus?.toLowerCase().includes('out') || item.inStock === false;
  const isInStock = item.stockStatus?.toLowerCase().includes('in stock') || item.inStock === true;

  return (
    <div
      className={`w-full rounded-m-xl border border-m-border bg-m-surface p-4 sm:p-5 hover:border-m-border-strong hover:shadow-m-card transition-all duration-150 ${className}`}
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
        {/* Left Column: Product Image / Bottle Thumbnail */}
        <div className="shrink-0 flex items-center justify-center w-14 sm:w-16 pt-1 self-start">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="max-h-28 w-auto object-contain"
            />
          ) : (
            <WineBottleGraphic />
          )}
        </div>

        {/* Right Column: Information, Pricing, Actions, Table */}
        <div className="flex-1 min-w-0 w-full space-y-3.5">
          {/* Top Section: Header & Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            {/* Title, SKU, Rating, Subtitle */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-m-text tracking-tight">
                  {titleAttr ? (
                    <Highlight
                      hit={item.raw as any}
                      attribute={titleAttr}
                      classNames={{
                        highlighted:
                          'bg-csa-yellow-100 text-csa-yellow-900 rounded px-0.5 font-bold not-italic'
                      }}
                    />
                  ) : (
                    <span>{item.title}</span>
                  )}
                </h3>
                {item.sku && (
                  <span className="font-mono text-xs text-m-text-muted font-normal">
                    {item.sku}
                  </span>
                )}
              </div>

              {item.rating !== undefined && (
                <RatingStars rating={item.rating} />
              )}

              {subtitle && (
                <div className="text-xs font-semibold text-m-primary tracking-tight">
                  {subtitle}
                </div>
              )}
            </div>

            {/* Price, Action Controls, Badges */}
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <div className="text-xs sm:text-sm font-semibold text-m-text">
                {item.unitsCount !== undefined
                  ? `${item.unitsCount} ${item.unitsCount === 1 ? 'bottle' : 'bottles'} · `
                  : '1 bottle · '}
                {item.price !== undefined ? formatCurrency(item.price, item.currency) : 'Price on request'}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  defaultValue={1}
                  aria-label="Quantity"
                  className="w-12 h-8 text-center text-xs font-medium rounded-m-md border border-m-border bg-m-surface text-m-text focus:outline-none focus:border-m-primary"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails?.(item)}
                  className="text-xs font-semibold px-4 whitespace-nowrap"
                >
                  View details
                </Button>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end pt-0.5">
                {isOutOfStock ? (
                  <Badge variant="error" size="sm" className="text-[10px]">
                    Out of Stock
                  </Badge>
                ) : isInStock ? (
                  <Badge variant="success" size="sm" className="text-[10px]">
                    In Stock
                  </Badge>
                ) : item.stockStatus ? (
                  <Badge variant="neutral" size="sm" className="text-[10px]">
                    {item.stockStatus}
                  </Badge>
                ) : null}

                {item.preSale && (
                  <Badge variant="warning" size="sm" className="text-[10px]">
                    Pre-sale
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Itemized Components Table */}
          {displayComponents.length > 0 && (
            <div className="rounded-m-lg border border-m-border bg-m-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <tbody className="divide-y divide-m-border/60">
                    {displayComponents.map((comp, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-m-surface-2/40 transition-colors"
                      >
                        <td className="py-2 px-3 font-semibold text-m-text w-10 text-center select-none">
                          {comp.quantity || 1}
                        </td>
                        <td className="py-2 px-3 font-medium text-m-primary">
                          {comp.name}
                        </td>
                        <td className="py-2 px-3 text-m-text-muted">
                          {comp.region || '—'}
                        </td>
                        <td className="py-2 px-3 text-m-text-muted">
                          {comp.grape || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

