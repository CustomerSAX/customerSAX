import React from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-m-xl border border-dashed border-m-border bg-m-surface/50',
        className,
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-m-primary-50 text-m-primary mb-3">
        {typeof icon === 'string' ? <Icon name={icon} size="lg" /> : icon}
      </div>
      <h4 className="text-sm font-semibold text-m-text mb-1">{title}</h4>
      {description && <p className="text-xs text-m-text-muted max-w-sm mb-4 leading-relaxed">{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
