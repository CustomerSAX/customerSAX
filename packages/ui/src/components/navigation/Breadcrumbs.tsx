'use client';

import React from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  onNavigate?: (item: BreadcrumbItem) => void;
}

export function Breadcrumbs({
  items,
  separator = <Icon name="chevron-right" size="xs" className="text-m-text-subtle" />,
  onNavigate,
  className,
  ...props
}: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center select-none', className)} {...props}>
      <ol className="flex items-center gap-1.5 text-xs text-m-text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1 || item.isCurrent;
          return (
            <React.Fragment key={index}>
              {index > 0 && <span className="flex items-center" aria-hidden>{separator}</span>}
              <li className="flex items-center gap-1">
                {isLast ? (
                  <span className="font-semibold text-m-text truncate max-w-[200px]" aria-current="page">
                    {item.icon && <span className="mr-1 inline-block shrink-0">{item.icon}</span>}
                    {item.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate?.(item)}
                    className="hover:text-m-text transition-colors flex items-center truncate max-w-[150px] outline-none rounded focus-visible:ring-1 focus-visible:ring-m-primary cursor-pointer"
                  >
                    {item.icon && <span className="mr-1 inline-block shrink-0">{item.icon}</span>}
                    {item.label}
                  </button>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
