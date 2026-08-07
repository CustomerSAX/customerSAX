'use client';

import React from 'react';
import { cn } from '../utils';
import { Icon } from '../icons/Icon';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  hint?: string;
  indeterminate?: boolean;
  size?: 'sm' | 'md';
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      hint,
      indeterminate = false,
      size = 'md',
      disabled,
      checked,
      className,
      id,
      onChange,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    const boxSize = size === 'sm' ? 'h-4 w-4' : 'h-4.5 w-4.5';

    return (
      <div className={cn('inline-flex items-start gap-2.5 select-none', disabled && 'opacity-50 cursor-not-allowed')}>
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={inputRef}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className={cn(
              'peer appearance-none rounded border bg-m-surface transition-all outline-none cursor-pointer',
              'border-m-border hover:border-m-border-strong',
              'checked:bg-m-primary checked:border-m-primary',
              'focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2',
              disabled && 'cursor-not-allowed',
              boxSize,
              className,
            )}
            {...props}
          />
          <span className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 flex items-center justify-center">
            {indeterminate ? (
              <span className="h-0.5 w-2.5 bg-current rounded-full" />
            ) : (
              <Icon name="check" size={size === 'sm' ? 'xs' : 'sm'} strokeWidth={3} />
            )}
          </span>
        </div>
        {(label || hint) && (
          <label htmlFor={checkboxId} className="flex flex-col cursor-pointer text-xs">
            {label && <span className="font-medium text-m-text">{label}</span>}
            {hint && <span className="text-m-text-muted">{hint}</span>}
          </label>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
