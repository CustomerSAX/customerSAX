'use client';

import React, { isValidElement, useEffect, useId, useRef, useState } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const focusItem = (position: 'first' | 'last') => {
    window.requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
      if (!items?.length) return;
      items[position === 'first' ? 0 : items.length - 1]?.focus();
    });
  };

  const openMenu = (position: 'first' | 'last' = 'first') => {
    setIsOpen(true);
    focusItem(position);
  };

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
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => {
          if (isOpen) setIsOpen(false);
          else openMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
          }
        }}
        className={cn(
          'rounded-m-md text-left outline-none focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2',
          isValidElement(trigger) ? (trigger.props as { className?: string }).className : undefined,
        )}
        style={isValidElement(trigger) ? (trigger.props as { style?: React.CSSProperties }).style : undefined}
      >
        {isValidElement(trigger) ? (trigger.props as { children?: React.ReactNode }).children : trigger}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={(event) => {
            const items = Array.from(
              menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
            );
            const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const delta = event.key === 'ArrowDown' ? 1 : -1;
              items[(currentIndex + delta + items.length) % items.length]?.focus();
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setIsOpen(false);
              triggerRef.current?.focus();
            } else if (event.key === 'Tab') {
              setIsOpen(false);
            }
          }}
          className={cn(
            'absolute z-[var(--m-z-dropdown)] mt-1.5 min-w-[180px] rounded-m-xl border border-m-border bg-m-surface p-1 shadow-m-panel animate-in zoom-in-95 fade-in duration-150',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {items.map((item, idx) => {
            if (item === 'divider') {
              return <div key={`divider-${idx}`} role="separator" className="my-1 border-t border-m-border/60" />;
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
