'use client';

import React, { useState } from 'react';
import { Input, InputProps } from './Input';
import { Icon } from '../icons/Icon';
import { cn } from '../utils';

export interface SearchBarProps extends Omit<InputProps, 'onChange'> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  onSearch?: (value: string) => void;
  shortcutHint?: string;
}

export function SearchBar({
  value: valueProp,
  defaultValue = '',
  onChange,
  onClear,
  onSearch,
  shortcutHint,
  placeholder = 'Search...',
  size = 'md',
  className,
  ...props
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    if (!isControlled) {
      setInternalValue(newVal);
    }
    onChange?.(newVal);
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue('');
    }
    onChange?.('');
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch?.(value);
    }
  };

  return (
    <Input
      size={size}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      leftIcon={<Icon name="search" size="sm" />}
      rightElement={
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-m-text-muted hover:text-m-text rounded-full transition-colors outline-none"
              aria-label="Clear search"
            >
              <Icon name="x" size="xs" />
            </button>
          )}
          {shortcutHint && !value && (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-m-border bg-m-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-m-text-muted">
              {shortcutHint}
            </kbd>
          )}
        </div>
      }
      className={cn('w-full', className)}
      {...props}
    />
  );
}
