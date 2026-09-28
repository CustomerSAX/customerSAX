'use client';

import { Button } from '@csa/ui';
import { AlertCircle, RotateCcw } from 'lucide-react';

export interface SearchErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function SearchErrorState({
  message = 'Unable to load search results. Please try again.',
  onRetry,
  className = ''
}: SearchErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6 text-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
        Search Unavailable
      </h3>
      <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry search
        </Button>
      )}
    </div>
  );
}
