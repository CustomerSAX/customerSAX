'use client';

import React, { createContext, useContext, useState } from 'react';
import { cn } from '../../utils';

export type TabsVariant = 'underline' | 'pill' | 'boxed';

interface TabsContextType {
  value: string;
  onChange: (value: string) => void;
  variant: TabsVariant;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({
  value: valueProp,
  defaultValue,
  onValueChange,
  variant = 'underline',
  className,
  children,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const isControlled = valueProp !== undefined;
  const activeValue = isControlled ? valueProp : internalValue;

  const handleChange = (val: string) => {
    if (!isControlled) setInternalValue(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onChange: handleChange, variant }}>
      <div className={cn('w-full flex flex-col gap-4', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export function TabsList({ className, children }: TabsListProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsList must be used within Tabs');

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 overflow-x-auto select-none border-b border-m-border/60 pb-px',
        context.variant === 'pill' && 'border-b-0 gap-2',
        context.variant === 'boxed' && 'border-b-0 p-1 bg-m-surface-2 rounded-m-lg gap-1 border border-m-border/60',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function TabsTrigger({ value, icon, disabled, className, children, ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => context.onChange(value)}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all outline-none rounded-m-md cursor-pointer whitespace-nowrap',
        'focus-visible:ring-2 focus-visible:ring-m-primary',
        disabled && 'opacity-40 cursor-not-allowed',

        // Underline variant
        context.variant === 'underline' &&
          (isActive
            ? 'text-m-primary border-b-2 border-m-primary -mb-px rounded-b-none'
            : 'text-m-text-muted hover:text-m-text border-b-2 border-transparent'),

        // Pill variant
        context.variant === 'pill' &&
          (isActive
            ? 'bg-m-primary text-white shadow-m-xs'
            : 'bg-m-surface-2 text-m-text-muted hover:text-m-text hover:bg-m-surface-3'),

        // Boxed variant
        context.variant === 'boxed' &&
          (isActive
            ? 'bg-m-surface text-m-text shadow-m-xs font-bold'
            : 'text-m-text-muted hover:text-m-text'),

        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.value !== value) return null;

  return (
    <div role="tabpanel" className={cn('outline-none pt-2', className)} {...props}>
      {children}
    </div>
  );
}

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;
