'use client';

import React from 'react';
import { cn } from '../../utils';

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  brandOrBreadcrumbs?: React.ReactNode;
  searchSlot?: React.ReactNode;
  actions?: React.ReactNode;
  userSlot?: React.ReactNode;
}

export function TopBar({
  brandOrBreadcrumbs,
  searchSlot,
  actions,
  userSlot,
  className,
  ...props
}: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-[var(--m-z-sticky)] flex h-16 w-full items-center justify-between gap-4 px-6 border-b border-m-topbar-border bg-m-topbar-bg backdrop-blur-md transition-colors',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-4 min-w-0">{brandOrBreadcrumbs}</div>

      {searchSlot && <div className="max-w-md w-full mx-4">{searchSlot}</div>}

      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {actions}
        {userSlot}
      </div>
    </header>
  );
}
