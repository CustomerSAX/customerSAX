'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '../utils';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export type IconName = keyof typeof LucideIcons;

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Name of the icon in the underlying library */
  name: string;
  /** Size preset or numeric pixel value */
  size?: IconSize;
  /** Optional stroke width */
  strokeWidth?: number;
  /** Optional custom class name */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
}

export function Icon({
  name,
  size = 'md',
  strokeWidth = 2,
  className,
  ariaLabel,
  ...props
}: IconProps) {
  // Convert kebab-case or PascalCase string to Lucide icon component name
  const pascalName = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = (LucideIcons as Record<string, any>)[pascalName] || LucideIcons.HelpCircle;

  const numericSize = typeof size === 'number' ? size : sizeMap[size] || 20;

  return (
    <IconComponent
      size={numericSize}
      strokeWidth={strokeWidth}
      className={cn('shrink-0 inline-block', className)}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      {...props}
    />
  );
}
