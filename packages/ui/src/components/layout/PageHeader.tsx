import React from 'react';
import { cn } from '../../utils';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  badge,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2 pb-4 border-b border-m-border/60', className)} {...props}>
      {breadcrumbs && <div className="mb-1">{breadcrumbs}</div>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-m-text tracking-tight">{title}</h1>
          {badge && <div>{badge}</div>}
        </div>
        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
      {subtitle && <p className="text-xs sm:text-sm text-m-text-muted">{subtitle}</p>}
    </div>
  );
}
