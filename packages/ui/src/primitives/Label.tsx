import React from 'react';
import { cn } from '../utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export function Label({ required, hint, className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn('block text-xs font-semibold text-m-text leading-none select-none', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-m-error" aria-hidden>
          *
        </span>
      )}
      {hint && <span className="ml-1.5 font-normal text-m-text-muted">{hint}</span>}
    </label>
  );
}
