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
        <div className="csa-topbar-brand flex items-center gap-3 min-w-0">
          {brandOrBreadcrumbs}
        </div>
      )}

      {/* Center: search */}
      {searchSlot && (
        <div className="csa-topbar-search min-w-0 flex-1 max-w-xl mx-4">
          {searchSlot}
        </div>
      )}

      {/* Right: actions + user */}
      <div className="csa-topbar-user flex flex-wrap items-center gap-2 min-w-0 ml-auto">
        {actions}
        {userSlot}
      </div>
    </header>
  );
}
