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
      className={cn('csa-topbar', className)}
      {...props}
    >
      {/* Left: breadcrumbs / brand label */}
      {brandOrBreadcrumbs && (
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          {brandOrBreadcrumbs}
        </div>
      )}

      {/* Center: search */}
      {searchSlot && (
        <div className="flex-1 max-w-xl mx-4">
          {searchSlot}
        </div>
      )}

      {/* Right: actions + user */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {actions}
        {userSlot}
      </div>
    </header>
  );
}
