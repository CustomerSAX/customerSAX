'use client';

import React from 'react';
import { cn } from '../utils';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: React.ReactNode;
  className?: string;
  id?: string;
}

export function Switch({
  checked: checkedProp,
  defaultChecked = false,
  onChange,
  disabled = false,
  size = 'md',
  label,
  className,
  id,
}: SwitchProps) {
  const [isChecked, setIsChecked] = React.useState(defaultChecked);
  const isControlled = checkedProp !== undefined;
  const activeChecked = isControlled ? checkedProp : isChecked;

  const toggle = () => {
    if (disabled) return;
    if (!isControlled) {
      setIsChecked(!activeChecked);
    }
    onChange?.(!activeChecked);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  };

  const trackSizes = size === 'sm' ? 'w-8 h-4.5' : 'w-10 h-5.5';
  const thumbSizes = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5';
  const translateStyles = activeChecked
    ? size === 'sm'
      ? 'translate-x-3.5'
      : 'translate-x-4.5'
    : 'translate-x-0.5';

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={activeChecked}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 outline-none cursor-pointer',
          'focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2',
          activeChecked ? 'bg-m-primary' : 'bg-m-neutral-300 dark:bg-m-neutral-700',
          trackSizes,
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-m-xs transition-transform duration-200 ease-out',
            thumbSizes,
            translateStyles,
          )}
        />
      </button>
      {label && (
        <span className="text-xs font-medium text-m-text cursor-pointer" onClick={toggle}>
          {label}
        </span>
      )}
    </div>
  );
}
