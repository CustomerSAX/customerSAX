'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export interface DropdownItem {
  id: string;
  label: React.ReactNode;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: (DropdownItem | 'divider')[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'right', className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            'absolute z-[var(--m-z-dropdown)] mt-1.5 min-w-[180px] rounded-m-xl border border-m-border bg-m-surface p-1 shadow-m-panel animate-in zoom-in-95 fade-in duration-150',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {items.map((item, idx) => {
            if (item === 'divider') {
              return <div key={`divider-${idx}`} className="my-1 border-t border-m-border/60" />;
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium rounded-m-md transition-colors outline-none cursor-pointer text-left select-none',
                  'hover:bg-m-surface-2 focus-visible:bg-m-surface-2',
                  item.danger && 'text-m-error hover:bg-m-error-light',
                  !item.danger && 'text-m-text',
                  item.disabled && 'opacity-40 cursor-not-allowed',
                )}
              >
                {item.icon && <Icon name={item.icon} size="xs" className="shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
