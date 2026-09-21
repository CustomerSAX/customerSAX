import React from 'react';

export type CSATextSize =
  | 'xs'
  | 'sm'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl';

export type CSATextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export type CSATextVariant =
  | 'default'
  | 'muted'
  | 'brand'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error';

export interface CSATextProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  size?: CSATextSize;
  weight?: CSATextWeight;
  variant?: CSATextVariant;
  truncate?: boolean;
  children: React.ReactNode;
}

export interface CSAHeadingProps extends Omit<CSATextProps, 'as'> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}
