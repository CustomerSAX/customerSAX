'use client';

import React from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export interface ChipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  label: React.ReactNode;
  onRemove?: () => void;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
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
  const content = (
    <>
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span>{label}</span>
    </>
  );

  if (onClick && !onRemove) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-m-md text-xs font-medium transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2',
          variant === 'subtle' && !selected && 'bg-m-surface-2 text-m-text border border-m-border hover:border-m-border-strong',
          variant === 'outline' && !selected && 'bg-transparent text-m-text border border-m-border hover:border-m-border-strong',
          selected && 'bg-m-primary-50 text-m-primary border border-m-primary-300 font-semibold',
          !disabled && 'cursor-pointer hover:bg-m-surface-3',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

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
      {...props}
    >
      {content}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onRemove();
          }}
          disabled={disabled}
          className="p-0.5 rounded-full hover:bg-m-neutral-200 dark:hover:bg-m-neutral-700 text-m-text-muted hover:text-m-text transition-colors outline-none focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-1"
          aria-label="Remove chip"
        >
          <Icon name="x" size="xs" />
        </button>
      )}
    </div>
  );
}
