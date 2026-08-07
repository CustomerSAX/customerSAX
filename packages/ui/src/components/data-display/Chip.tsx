'use client';

import React from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  variant?: 'subtle' | 'outline';
}

export function Chip({
  label,
  onRemove,
  onClick,
  selected = false,
  disabled = false,
  leftIcon,
  variant = 'subtle',
  className,
  ...props
}: ChipProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-m-md text-xs font-medium transition-all select-none',
        variant === 'subtle' && !selected && 'bg-m-surface-2 text-m-text border border-m-border hover:border-m-border-strong',
        variant === 'outline' && !selected && 'bg-transparent text-m-text border border-m-border hover:border-m-border-strong',
        selected && 'bg-m-primary-50 text-m-primary border border-m-primary-300 font-semibold',
        onClick && !disabled && 'cursor-pointer hover:bg-m-surface-3',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onRemove();
          }}
          className="p-0.5 rounded-full hover:bg-m-neutral-200 dark:hover:bg-m-neutral-700 text-m-text-muted hover:text-m-text transition-colors outline-none"
          aria-label="Remove chip"
        >
          <Icon name="x" size="xs" />
        </button>
      )}
    </div>
  );
}
