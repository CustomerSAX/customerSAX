import React from 'react';
import { cn } from '../utils';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'code';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  weight?: FontWeight;
  align?: 'left' | 'center' | 'right';
  color?: 'default' | 'muted' | 'subtle' | 'primary' | 'error' | 'success' | 'warning' | 'white';
  as?: React.ElementType;
  children: React.ReactNode;
}

const variantStyles: Record<TextVariant, string> = {
  h1: 'text-3xl tracking-tight leading-tight',
  h2: 'text-2xl tracking-tight leading-snug',
  h3: 'text-xl font-semibold leading-snug',
  h4: 'text-lg font-semibold leading-normal',
  body: 'text-base leading-normal',
  'body-sm': 'text-sm leading-normal',
  caption: 'text-xs text-m-text-muted leading-normal',
  code: 'font-mono text-xs px-1.5 py-0.5 rounded-m-sm bg-m-surface-2 border border-m-border',
};

const weightStyles: Record<FontWeight, string> = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colorStyles: Record<NonNullable<TextProps['color']>, string> = {
  default: 'text-m-text',
  muted: 'text-m-text-muted',
  subtle: 'text-m-text-subtle',
  primary: 'text-m-primary',
  error: 'text-m-error',
  success: 'text-m-success',
  warning: 'text-m-warning',
  white: 'text-white',
};

const defaultElementMap: Record<TextVariant, React.ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  body: 'p',
  'body-sm': 'p',
  caption: 'span',
  code: 'code',
};

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      variant = 'body',
      weight,
      align = 'left',
      color = 'default',
      as,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const Component = as || defaultElementMap[variant] || 'span';

    return (
      <Component
        ref={ref}
        className={cn(
          variantStyles[variant],
          weight && weightStyles[weight],
          colorStyles[color],
          align === 'center' && 'text-center',
          align === 'right' && 'text-right',
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Text.displayName = 'Text';
