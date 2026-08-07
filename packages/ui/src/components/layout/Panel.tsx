'use client';

import React, { useState } from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function Panel({
  title,
  subtitle,
  headerActions,
  collapsible = false,
  defaultExpanded = true,
  className,
  children,
  ...props
}: PanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn('rounded-m-xl border border-m-border bg-m-surface shadow-m-panel overflow-hidden', className)}
      {...props}
    >
      {(title || headerActions || collapsible) && (
        <div
          className={cn(
            'flex items-center justify-between px-5 py-4 border-b border-m-border/60 bg-m-surface-1',
            collapsible && 'cursor-pointer select-none hover:bg-m-surface-2/50',
          )}
          onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
        >
          <div className="flex flex-col gap-0.5">
            {title && <h3 className="text-sm font-semibold text-m-text">{title}</h3>}
            {subtitle && <p className="text-xs text-m-text-muted">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {headerActions}
            {collapsible && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-m-text-muted hover:text-m-text rounded transition-colors"
                aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
              >
                <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size="sm" />
              </button>
            )}
          </div>
        </div>
      )}

      {(!collapsible || isExpanded) && <div className="p-5">{children}</div>}
    </div>
  );
}
