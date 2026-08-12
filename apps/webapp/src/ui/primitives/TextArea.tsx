'use client';

import React from 'react';
import { cn } from '../utils';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  maxLength?: number;
  showCount?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const resizeStyles = {
  none: 'resize-none',
  vertical: 'resize-y',
  horizontal: 'resize-x',
  both: 'resize',
};

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      error = false,
      maxLength,
      showCount = false,
      resize = 'vertical',
      disabled,
      className,
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className="relative flex flex-col w-full">
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          disabled={disabled}
          maxLength={maxLength}
          aria-invalid={error}
          className={cn(
            'w-full rounded-m-lg border bg-m-surface p-3 text-xs text-m-text placeholder:text-m-text-subtle outline-none min-h-[90px]',
            'transition-[border-color,box-shadow] duration-[var(--m-t-fast)] ease-[var(--m-ease-enterprise)]',
            !error && 'border-m-border hover:border-m-border-strong focus:border-m-primary focus:ring-2 focus:ring-m-primary/20',
            error && 'border-m-error focus:border-m-error focus:ring-2 focus:ring-m-error/20',
            disabled && 'cursor-not-allowed opacity-50 bg-m-surface-2',
            resizeStyles[resize],
            className,
          )}
          {...props}
        />
        {showCount && maxLength && (
          <span className="self-end text-[10px] text-m-text-muted mt-1">
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';
