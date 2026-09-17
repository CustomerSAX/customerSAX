'use client';

import React, { createContext, useContext, useId, useEffect } from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

const DrawerContext = createContext<{ titleId: string; descriptionId: string } | null>(null);

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'right' | 'left';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

const sizeStyles: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: 'max-w-xs',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  full: 'max-w-full',
};

export function Drawer({
  isOpen,
  onClose,
  position = 'right',
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children,
  className,
  'aria-label': ariaLabel,
}: DrawerProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const dialogRef = useDialogAccessibility<HTMLDivElement>({ isOpen, onClose, closeOnEsc });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[var(--m-z-drawer)] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-m-neutral-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Slide-over panel */}
      <div
        className={cn(
          'fixed inset-y-0 flex max-w-full z-10',
          position === 'right' ? 'right-0' : 'left-0',
        )}
      >
        <div
          className={cn(
            'w-screen border-l border-m-border bg-m-surface shadow-m-panel flex flex-col',
            'animate-in slide-in-from-right duration-300 ease-out',
            sizeStyles[size],
            className,
          )}
        >
          <DrawerContext.Provider value={{ titleId, descriptionId }}>
            {children}
          </DrawerContext.Provider>
        </div>
      </div>
    </div>
  );
}

export function DrawerHeader({
  title,
  subtitle,
  onClose,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const context = useContext(DrawerContext);
  return (
    <div className={cn('flex items-start justify-between p-6 border-b border-m-border/60 bg-m-surface-1', className)}>
      <div className="flex flex-col gap-1">
        {title && <h2 id={context?.titleId} className="text-base font-bold text-m-text tracking-tight">{title}</h2>}
        {subtitle && <p id={context?.descriptionId} className="text-xs text-m-text-muted">{subtitle}</p>}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-m-md text-m-text-muted hover:text-m-text hover:bg-m-surface-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2"
          aria-label="Close drawer"
        >
          <Icon name="x" size="sm" />
        </button>
      )}
    </div>
  );
}

export function DrawerContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6 overflow-y-auto flex-1 space-y-4 text-xs text-m-text leading-relaxed', className)} {...props}>
      {children}
    </div>
  );
}

export function DrawerFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-end gap-3 p-6 border-t border-m-border/60 bg-m-surface-2/40', className)} {...props}>
      {children}
    </div>
  );
}

Drawer.Header = DrawerHeader;
Drawer.Content = DrawerContent;
Drawer.Footer = DrawerFooter;
