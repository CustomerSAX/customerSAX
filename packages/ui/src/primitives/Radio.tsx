'use client';

import React, { createContext, useContext, useId } from 'react';
import { cn } from '../utils';

interface RadioGroupContextValue {
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

export interface RadioGroupProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function RadioGroup({
  name,
  value,
  onChange,
  disabled,
  className,
  children,
}: RadioGroupProps) {
  const generatedName = useId();
  const groupName = name || generatedName;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <RadioGroupContext.Provider value={{ name: groupName, value, onChange: handleChange, disabled }}>
      <div role="radiogroup" className={cn('flex flex-col gap-2', className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: React.ReactNode;
  hint?: string;
  value: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, hint, value, disabled, className, id, ...props }, ref) => {
    const context = useContext(RadioGroupContext);
    const generatedId = useId();
    const radioId = id || generatedId;

    const isChecked = context?.value !== undefined ? context.value === value : props.checked;
    const isDisabled = disabled || context?.disabled;
    const groupName = context?.name || props.name;

    return (
      <div className={cn('inline-flex items-start gap-2.5 select-none', isDisabled && 'opacity-50 cursor-not-allowed')}>
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="radio"
            id={radioId}
            name={groupName}
            value={value}
            checked={isChecked}
            disabled={isDisabled}
            onChange={context?.onChange}
            className={cn(
              'peer appearance-none h-4.5 w-4.5 rounded-full border bg-m-surface transition-all outline-none cursor-pointer',
              'border-m-border hover:border-m-border-strong',
              'checked:border-m-primary checked:bg-m-surface',
              'focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2',
              isDisabled && 'cursor-not-allowed',
              className,
            )}
            {...props}
          />
          <span className="pointer-events-none absolute h-2 w-2 rounded-full bg-m-primary opacity-0 peer-checked:opacity-100 transition-opacity" />
        </div>
        {(label || hint) && (
          <label htmlFor={radioId} className="flex flex-col cursor-pointer text-xs">
            {label && <span className="font-medium text-m-text">{label}</span>}
            {hint && <span className="text-m-text-muted">{hint}</span>}
          </label>
        )}
      </div>
    );
  },
);

Radio.displayName = 'Radio';
