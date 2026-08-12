'use client';

import React from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastProps {
  variant?: ToastVariant;
  title: string;
  description?: string;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<ToastVariant, { border: string; bg: string; icon: string; iconName: string }> = {
  success: {
    border: 'border-m-success-border',
    bg: 'bg-m-success-light',
    icon: 'text-m-success',
    iconName: 'check-circle',
  },
  warning: {
    border: 'border-m-warning-border',
    bg: 'bg-m-warning-light',
    icon: 'text-m-warning',
    iconName: 'alert-triangle',
  },
  error: {
    border: 'border-m-error-border',
    bg: 'bg-m-error-light',
    icon: 'text-m-error',
    iconName: 'alert-circle',
  },
  info: {
    border: 'border-m-info-border',
    bg: 'bg-m-info-light',
    icon: 'text-m-info',
    iconName: 'info',
  },
};

export function Toast({
  variant = 'info',
  title,
  description,
  onClose,
  action,
  className,
}: ToastProps) {
  const config = variantStyles[variant];

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 p-4 rounded-m-xl border bg-m-surface shadow-m-panel max-w-sm w-full animate-in slide-in-from-bottom-5 duration-200',
        config.border,
        className,
      )}
    >
      <div className={cn('mt-0.5 shrink-0', config.icon)}>
        <Icon name={config.iconName} size="md" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-m-text">{title}</h4>
        {description && <p className="text-[11px] text-m-text-muted mt-0.5 leading-relaxed">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-m-md text-m-text-muted hover:text-m-text hover:bg-m-surface-2 transition-colors outline-none"
          aria-label="Dismiss notification"
        >
          <Icon name="x" size="xs" />
        </button>
      )}
    </div>
  );
}
