'use client';

import React, { useEffect } from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  className?: string;
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
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

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
      className="fixed inset-0 z-[var(--m-z-modal)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-m-neutral-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal Dialog Surface */}
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
    </div>
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
  return (
    <div className={cn('flex items-start justify-between p-6 border-b border-m-border/60 bg-m-surface-1', className)}>
      <div className="flex flex-col gap-1">
        {title && <h3 className="text-lg font-bold text-m-text tracking-tight">{title}</h3>}
        {subtitle && <p className="text-xs text-m-text-muted">{subtitle}</p>}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-m-md text-m-text-muted hover:text-m-text hover:bg-m-surface-2 transition-colors outline-none"
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
