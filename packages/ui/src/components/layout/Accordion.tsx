'use client';

import React, { createContext, useContext, useState } from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

interface AccordionContextType {
  openValues: string[];
  toggleValue: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

export interface AccordionProps {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  className?: string;
  children: React.ReactNode;
}

export function Accordion({
  type = 'single',
  defaultValue,
  value: valueProp,
  onValueChange,
  className,
  children,
}: AccordionProps) {
  const [internalValues, setInternalValues] = useState<string[]>(() => {
    if (Array.isArray(defaultValue)) return defaultValue;
    if (defaultValue) return [defaultValue];
    return [];
  });

  const isControlled = valueProp !== undefined;
  const activeValues = isControlled
    ? Array.isArray(valueProp)
      ? valueProp
      : valueProp
      ? [valueProp]
      : []
    : internalValues;

  const toggleValue = (val: string) => {
    let next: string[];
    if (type === 'single') {
      next = activeValues.includes(val) ? [] : [val];
    } else {
      next = activeValues.includes(val)
        ? activeValues.filter((v) => v !== val)
        : [...activeValues, val];
    }

    if (!isControlled) {
      setInternalValues(next);
    }

    if (onValueChange) {
      onValueChange(type === 'single' ? next[0] || '' : next);
    }
  };

  return (
    <AccordionContext.Provider value={{ openValues: activeValues, toggleValue }}>
      <div className={cn('divide-y divide-m-border rounded-m-xl border border-m-border bg-m-surface overflow-hidden', className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemContextType {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextType | undefined>(undefined);

export interface AccordionItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function AccordionItem({ value, disabled = false, className, children }: AccordionItemProps) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionItem must be used within Accordion');

  const isOpen = context.openValues.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div className={cn(disabled && 'opacity-50 pointer-events-none', className)}>{children}</div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function AccordionTrigger({ className, children, ...props }: AccordionTriggerProps) {
  const context = useContext(AccordionContext);
  const itemContext = useContext(AccordionItemContext);

  if (!context || !itemContext) {
    throw new Error('AccordionTrigger must be used within AccordionItem');
  }

  return (
    <button
      type="button"
      onClick={() => context.toggleValue(itemContext.value)}
      aria-expanded={itemContext.isOpen}
      className={cn(
        'flex w-full items-center justify-between p-4 text-xs font-semibold text-m-text transition-colors hover:bg-m-surface-2/60 text-left outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-m-primary',
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <Icon
        name="chevron-down"
        size="sm"
        className={cn('text-m-text-muted transition-transform duration-200', itemContext.isOpen && 'rotate-180')}
      />
    </button>
  );
}

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AccordionContent({ className, children, ...props }: AccordionContentProps) {
  const itemContext = useContext(AccordionItemContext);
  if (!itemContext) throw new Error('AccordionContent must be used within AccordionItem');

  if (!itemContext.isOpen) return null;

  return (
    <div className={cn('p-4 pt-0 text-xs text-m-text-muted leading-relaxed', className)} {...props}>
      {children}
    </div>
  );
}

Accordion.Item = AccordionItem;
Accordion.Trigger = AccordionTrigger;
Accordion.Content = AccordionContent;
