import React from 'react';

export type CSAButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'outline';

export type CSAButtonSize = 'sm' | 'md' | 'lg';

export interface CSAButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CSAButtonVariant;
  size?: CSAButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export interface CSAIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: CSAButtonSize;
  variant?: CSAButtonVariant;
  label?: string;
  loading?: boolean;
}
