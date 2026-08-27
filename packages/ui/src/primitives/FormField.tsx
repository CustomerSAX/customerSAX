'use client';

import React, { useId } from 'react';
import { Label } from './Label';
import { cn } from '../utils';

export interface FormFieldProps {
  label?: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  hint,
  error,
  required,
  htmlFor: htmlForProp,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = htmlForProp || generatedId;

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: fieldId,
            ...(error ? { error: true, 'aria-invalid': true, 'aria-describedby': `${fieldId}-error` } : {}),
            required,
          })
        : children}
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-m-error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${fieldId}-hint`} className="text-xs text-m-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
