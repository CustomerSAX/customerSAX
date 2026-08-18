import React from 'react';
import { cn } from '../utils';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'h-8 text-xs px-3',
  md: 'h-[38px] text-xs px-3.5',
  lg: 'h-11 text-sm px-4',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      error = false,
      leftIcon,
      rightElement,
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span
            className="pointer-events-none absolute left-3 flex items-center text-m-text-muted"
            aria-hidden
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          aria-invalid={error}
          className={cn(
            'w-full rounded-m-lg border bg-m-surface outline-none text-m-text placeholder:text-m-text-subtle',
            'transition-[border-color,box-shadow] duration-[var(--m-t-fast)] ease-[var(--m-ease-enterprise)]',
            !error && 'border-m-border hover:border-m-border-strong focus:border-m-primary focus:ring-2 focus:ring-m-primary/20',
            error && 'border-m-error focus:border-m-error focus:ring-2 focus:ring-m-error/20',
            disabled && 'cursor-not-allowed opacity-50 bg-m-surface-2',
            sizeStyles[size],
            Boolean(leftIcon) && 'pl-9',
            Boolean(rightElement) && 'pr-9',
            className,
          )}
          {...props}
        />
        {rightElement && (
          <span className="absolute right-2.5 flex items-center">{rightElement}</span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
