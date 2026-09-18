import React from 'react';

export type CSABadgeVariant =
  | 'brand'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'navy';

export type CSABadgeSize = 'xs' | 'sm' | 'md';

export interface CSABadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: CSABadgeVariant;
  size?: CSABadgeSize;
  dot?: boolean;
  leftIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export interface CSAChipProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  onDelete?: () => void;
  selected?: boolean;
  disabled?: boolean;
  variant?: CSABadgeVariant;
  icon?: React.ReactNode;
}

export interface CSAAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  fallbackColor?: string;
}

export interface CSACardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  interactive?: boolean;
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}
