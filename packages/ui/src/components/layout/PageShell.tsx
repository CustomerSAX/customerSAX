import React from 'react';
import { cn } from '../../utils';

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

const maxWidthStyles = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1440px]',
  full: 'max-w-none',
};

export function PageShell({
  maxWidth = 'full',
  className,
  children,
  ...props
}: PageShellProps) {
  return (
    <div
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6',
        maxWidthStyles[maxWidth],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
