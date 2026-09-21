'use client';

import React, { createContext, useContext, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

const ModalContext = createContext<{ titleId: string; descriptionId: string } | null>(null);

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] h-[90vh]',
};

export function Modal({
  isOpen,
  onClose,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children,
  className,
  'aria-label': ariaLabel,
}: ModalProps) {
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

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
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

      {/* Modal Dialog Surface */}
      <ModalContext.Provider value={{ titleId, descriptionId }}>
        <div
          className={cn(
            'relative w-full rounded-m-2xl border border-m-border bg-m-surface shadow-m-modal overflow-hidden',
            'animate-in zoom-in-95 fade-in duration-200 z-10 flex flex-col',
            sizeStyles[size],
            className,
          )}
        >
          {children}
        </div>
      </ModalContext.Provider>
    </div>,
    document.body,
  );
}

export function ModalHeader({
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
  const context = useContext(ModalContext);
  return (
    <div className={cn('flex items-start justify-between p-6 border-b border-m-border/60 bg-m-surface-1', className)}>
      <div className="flex flex-col gap-1">
        {title && <h2 id={context?.titleId} className="text-lg font-bold text-m-text tracking-tight">{title}</h2>}
        {subtitle && <p id={context?.descriptionId} className="text-xs text-m-text-muted">{subtitle}</p>}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-m-md text-m-text-muted hover:text-m-text hover:bg-m-surface-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2"
          aria-label="Close modal"
        >
          <Icon name="x" size="sm" />
        </button>
      )}
    </div>
  );
}

export function ModalBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6 overflow-y-auto flex-1 space-y-4 text-xs text-m-text leading-relaxed', className)} {...props}>
      {children}
    </div>
  );
}

export function ModalFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-end gap-3 p-6 border-t border-m-border/60 bg-m-surface-2/40 rounded-b-m-2xl', className)} {...props}>
      {children}
    </div>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
