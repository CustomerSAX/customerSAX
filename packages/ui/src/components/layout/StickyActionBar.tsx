import React from 'react';
import { cn } from '../../utils';

export interface StickyActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  info?: React.ReactNode;
  actions: React.ReactNode;
  position?: 'bottom' | 'top';
}

export function StickyActionBar({
  info,
  actions,
  position = 'bottom',
  className,
  ...props
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'sticky z-[var(--m-z-sticky)] left-0 right-0 p-4 border-t border-m-border bg-m-topbar-bg backdrop-blur-md shadow-m-panel',
        position === 'bottom' ? 'bottom-0' : 'top-0 border-b border-t-0',
        className,
      )}
      {...props}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div>{info}</div>
        <div className="flex items-center gap-3">{actions}</div>
      </div>
    </div>
  );
}
