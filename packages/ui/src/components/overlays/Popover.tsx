'use client';

import React, { isValidElement, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../utils';

export interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Popover({ trigger, content, align = 'left', className }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        onClick={() => setIsOpen(!isOpen)}
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
          id={contentId}
          className={cn(
            'absolute z-[var(--m-z-dropdown)] mt-2 min-w-[200px] rounded-m-xl border border-m-border bg-m-surface p-3 shadow-m-panel animate-in zoom-in-95 fade-in duration-150',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
