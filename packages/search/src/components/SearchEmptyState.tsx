'use client';

import { EmptyState, Button } from '@csa/ui';
import { RotateCcw } from 'lucide-react';
import { useClearRefinements } from 'react-instantsearch';

export interface SearchEmptyStateProps {
  onReset?: () => void;
  className?: string;
}

export function SearchEmptyState({ onReset, className = '' }: SearchEmptyStateProps) {
  const { canRefine, refine } = useClearRefinements();

  const handleClear = () => {
    if (canRefine) {
      refine();
    }
    if (onReset) {
      onReset();
    }
  };

  return (
    <div className={`py-12 px-4 ${className}`}>
      <EmptyState
        icon="search"
        title="No results found"
        description="Try adjusting your search or removing some filters to find what you're looking for."
        action={
          canRefine ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset all filters
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
