'use client';

import React from 'react';
import { cn } from '../../utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
}

const sizeStyles: Record<AvatarSize, { box: string; font: string; status: string }> = {
  xs: { box: 'h-6 w-6', font: 'text-[10px]', status: 'h-1.5 w-1.5 ring-1' },
  sm: { box: 'h-8 w-8', font: 'text-xs', status: 'h-2 w-2 ring-2' },
  md: { box: 'h-10 w-10', font: 'text-sm', status: 'h-2.5 w-2.5 ring-2' },
  lg: { box: 'h-12 w-12', font: 'text-base', status: 'h-3 w-3 ring-2' },
  xl: { box: 'h-16 w-16', font: 'text-lg', status: 'h-4 w-4 ring-2' },
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-m-success',
  offline: 'bg-m-neutral-400',
  busy: 'bg-m-error',
  away: 'bg-m-warning',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  status,
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const initials = getInitials(name || alt);

  return (
    <div className="relative inline-block shrink-0" {...props}>
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-full bg-m-primary-100 text-m-primary-700 font-semibold border border-m-primary-200 select-none',
          sizeStyles[size].box,
          sizeStyles[size].font,
          className,
        )}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-white dark:ring-m-neutral-900',
            statusColors[status],
            sizeStyles[size].status,
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
