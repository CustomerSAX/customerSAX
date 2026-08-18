import React from 'react';
import { cn } from '../../utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  rounded,
  className,
  style,
  ...props
}: SkeletonProps) {
  const customStyles: React.CSSProperties = {
    width,
    height,
    ...style,
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-m-neutral-200 dark:bg-m-neutral-800 select-none',
        variant === 'text' && 'h-3.5 w-full rounded-m-sm my-1',
        variant === 'circular' && 'rounded-full shrink-0',
        variant === 'rectangular' && 'rounded-m-md w-full h-12',
        variant === 'card' && 'rounded-m-xl w-full h-36 border border-m-border/40',
        rounded === 'none' && 'rounded-none',
        rounded === 'sm' && 'rounded-m-sm',
        rounded === 'md' && 'rounded-m-md',
        rounded === 'lg' && 'rounded-m-lg',
        rounded === 'xl' && 'rounded-m-xl',
        rounded === '2xl' && 'rounded-m-2xl',
        rounded === 'full' && 'rounded-m-full',
        className,
      )}
      style={customStyles}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 w-full', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? '70%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton variant="text" width={i === 0 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  );
}

Skeleton.Text = SkeletonText;
Skeleton.TableRow = SkeletonTableRow;
