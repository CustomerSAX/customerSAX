import React from 'react';
import { cn } from '../utils';
import { Icon } from '../icons/Icon';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: SelectSize;
  error?: boolean;
  leftIcon?: React.ReactNode;
  options?: SelectOption[];
  children?: React.ReactNode;
}

const sizeStyles: Record<SelectSize, string> = {
  sm: 'h-8 text-xs pl-3 pr-8',
  md: 'h-[38px] text-xs pl-3.5 pr-9',
  lg: 'h-11 text-sm pl-4 pr-10',
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      size = 'md',
      error = false,
      leftIcon,
      options,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 flex items-center text-m-text-muted" aria-hidden>
            {leftIcon}
          </span>
        )}
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={error}
          className={cn(
            'w-full appearance-none rounded-m-lg border bg-m-surface outline-none text-m-text cursor-pointer',
            'transition-[border-color,box-shadow] duration-[var(--m-t-fast)] ease-[var(--m-ease-enterprise)]',
            !error && 'border-m-border hover:border-m-border-strong focus:border-m-primary focus:ring-2 focus:ring-m-primary/20',
            error && 'border-m-error focus:border-m-error focus:ring-2 focus:ring-m-error/20',
            disabled && 'cursor-not-allowed opacity-50 bg-m-surface-2',
            sizeStyles[size],
            Boolean(leftIcon) && 'pl-9',
            className,
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <span className="pointer-events-none absolute right-3 flex items-center text-m-text-muted">
          <Icon name="chevron-down" size="sm" />
        </span>
      </div>
    );
  },
);

Select.displayName = 'Select';
