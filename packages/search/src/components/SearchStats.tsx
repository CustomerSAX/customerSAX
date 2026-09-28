'use client';

import { useStats } from 'react-instantsearch';

export interface SearchStatsProps {
  className?: string;
}

export function SearchStats({ className = '' }: SearchStatsProps) {
  const { nbHits } = useStats();

  return (
    <div className={`text-xs sm:text-sm text-m-text font-medium ${className}`}>
      <span className="font-bold text-m-text">{nbHits.toLocaleString()}</span>{' '}
      <span className="text-m-text-muted">{nbHits === 1 ? 'product' : 'products'}</span>
    </div>
  );
}

