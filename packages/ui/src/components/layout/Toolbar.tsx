'use client';

import React from 'react';
import { cn } from '../../utils';

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export function Toolbar({ left, right, className, children, ...props }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 p-3 rounded-m-lg border border-m-border bg-m-surface-1 shadow-m-xs',
        className,
      )}
      {...props}
    >
      {left && <div className="flex flex-wrap items-center gap-2.5">{left}</div>}
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
      {right && <div className="flex flex-wrap items-center gap-2.5 ml-auto">{right}</div>}
    </div>
  );
}
