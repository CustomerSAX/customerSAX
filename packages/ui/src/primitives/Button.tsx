import React from 'react';
import { cn } from '../utils';
import { Icon } from '../icons/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'text-white border border-m-primary-600 bg-m-primary shadow-m-xs ' +
    'hover:bg-m-primary-600 active:bg-m-primary-700 disabled:bg-m-primary/50 disabled:border-transparent',

  secondary:
    'text-m-text border border-m-border bg-m-surface shadow-m-xs ' +
    'hover:border-m-border-strong hover:bg-m-surface-2 active:bg-m-surface-3 disabled:opacity-50',

  ghost:
    'text-m-text-muted border border-transparent bg-transparent ' +
    'hover:bg-m-surface-2 hover:text-m-text active:bg-m-surface-3 disabled:opacity-50',

  danger:
    'text-white border border-m-error bg-m-error shadow-m-xs ' +
    'hover:bg-m-error-dark active:bg-m-error-dark disabled:opacity-50',

  outline:
    'text-m-primary border border-m-primary-200 bg-m-primary-50 ' +
    'hover:bg-m-primary-100 hover:border-m-primary-300 active:bg-m-primary-200 disabled:opacity-50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-[38px] px-4 text-xs gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

const iconOnlySizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-[38px] w-[38px]',
  lg: 'h-11 w-11',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      iconOnly = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-m-lg',
          'select-none outline-none transition-all duration-[var(--m-t-fast)] ease-[var(--m-ease-enterprise)]',
          !isDisabled && 'hover:-translate-y-px active:translate-y-0',
          'focus-visible:ring-2 focus-visible:ring-m-primary focus-visible:ring-offset-2',
          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
          fullWidth && 'w-full',
          variantStyles[variant],
          iconOnly ? iconOnlySizeStyles[size] : sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Icon name="loader-2" className="animate-spin" size={size === 'sm' ? 'xs' : 'sm'} />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {!iconOnly && children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
