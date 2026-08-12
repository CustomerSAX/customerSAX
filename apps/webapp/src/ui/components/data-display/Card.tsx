'use client';

import React from 'react';
import { cn } from '../../utils';
import { Badge } from './Badge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'flat' | 'dark';
  clickable?: boolean;
  children: React.ReactNode;
}

export function Card({
  variant = 'default',
  clickable = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-m-xl transition-all duration-[var(--m-t-fast)] ease-[var(--m-ease-enterprise)]',
        variant === 'default' && 'bg-m-surface border border-m-border shadow-m-card',
        variant === 'outlined' && 'bg-m-surface border border-m-border',
        variant === 'flat' && 'bg-m-surface-2 border border-transparent',
        variant === 'dark' && 'bg-m-neutral-950 text-white border border-m-neutral-800 shadow-m-card',
        clickable && 'cursor-pointer hover:border-m-border-strong hover:shadow-m-md hover:-translate-y-0.5 active:translate-y-0',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1 p-5 border-b border-m-border/60', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-m-text tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-m-text-muted', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between p-5 border-t border-m-border/60 bg-m-surface-2/40 rounded-b-m-xl', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: React.ReactNode;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  subtitle?: string;
}

export function CardMetric({
  title,
  value,
  trend,
  icon,
  subtitle,
  className,
  ...props
}: CardMetricProps) {
  return (
    <Card className={cn('p-5', className)} {...props}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-m-text-muted uppercase tracking-wider">{title}</span>
        {icon && <span className="p-2 rounded-m-md bg-m-primary-50 text-m-primary">{icon}</span>}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xl font-bold text-m-text tracking-tight">{value}</span>
        {trend && (
          <Badge
            variant={trend.direction === 'up' ? 'success' : trend.direction === 'down' ? 'error' : 'neutral'}
            size="sm"
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '•'} {trend.value}
          </Badge>
        )}
      </div>
      {subtitle && <p className="text-xs text-m-text-muted mt-1.5">{subtitle}</p>}
    </Card>
  );
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;
Card.Metric = CardMetric;
