import React from 'react';
import { cn } from '../../utils';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'brand';
export type BadgeAppearance = 'subtle' | 'solid' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  appearance?: BadgeAppearance;
  size?: BadgeSize;
  dot?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantSubtle: Record<BadgeVariant, string> = {
  neutral: 'bg-m-surface-2 text-m-text border-m-border',
  primary: 'bg-m-primary-50 text-m-primary border-m-primary-200',
  success: 'bg-m-success-light text-m-success border-m-success-border',
  warning: 'bg-m-warning-light text-m-warning-dark border-m-warning-border',
  error: 'bg-m-error-light text-m-error border-m-error-border',
  info: 'bg-m-info-light text-m-info-dark border-m-info-border',
  brand: 'bg-m-primary-50 text-m-primary-700 border-m-primary-200',
};

const variantSolid: Record<BadgeVariant, string> = {
  neutral: 'bg-m-neutral-700 text-white border-transparent',
  primary: 'bg-m-primary text-white border-transparent',
  success: 'bg-m-success text-white border-transparent',
  warning: 'bg-m-warning text-white border-transparent',
  error: 'bg-m-error text-white border-transparent',
  info: 'bg-m-info text-white border-transparent',
  brand: 'bg-m-primary-700 text-white border-transparent',
};

const variantOutline: Record<BadgeVariant, string> = {
  neutral: 'bg-transparent text-m-text border-m-border-strong',
  primary: 'bg-transparent text-m-primary border-m-primary',
  success: 'bg-transparent text-m-success border-m-success',
  warning: 'bg-transparent text-m-warning border-m-warning',
  error: 'bg-transparent text-m-error border-m-error',
  info: 'bg-transparent text-m-info border-m-info',
  brand: 'bg-transparent text-m-primary-700 border-m-primary-700',
};

const dotColors: Record<BadgeVariant, string> = {
  neutral: 'bg-m-neutral-400',
  primary: 'bg-m-primary',
  success: 'bg-m-success',
  warning: 'bg-m-warning',
  error: 'bg-m-error',
  info: 'bg-m-info',
  brand: 'bg-m-primary-600',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-0.5 gap-1.5',
  lg: 'text-xs px-3 py-1 gap-1.5',
};

export function Badge({
  variant = 'neutral',
  appearance = 'subtle',
  size = 'md',
  dot = false,
  leftIcon,
  rightIcon,
  className,
  children,
  ...props
}: BadgeProps) {
  const appearanceStyle =
    appearance === 'solid'
      ? variantSolid[variant]
      : appearance === 'outline'
      ? variantOutline[variant]
      : variantSubtle[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap font-medium rounded-m-full border leading-none select-none',
        appearanceStyle,
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])} aria-hidden />
      )}
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </span>
  );
}
