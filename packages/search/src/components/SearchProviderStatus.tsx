'use client';

import { useState } from 'react';
import { Badge } from '@csa/ui';
import { Database, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import type { SearchCapabilityState } from '../contracts/SearchCapability';

export interface SearchProviderStatusProps {
  state: SearchCapabilityState;
  className?: string;
  collapsible?: boolean;
}

export function SearchProviderStatus({
  state,
  className = '',
  collapsible = true
}: SearchProviderStatusProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isConnected = state.status === 'connected';

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-m-lg border border-m-border bg-m-surface shadow-m-xs text-xs">
        <Database className="w-3.5 h-3.5 text-m-text-muted" />
        <span className="font-medium text-m-text">
          {state.providerName}
        </span>
        <Badge
          variant={isConnected ? 'success' : 'neutral'}
          size="sm"
          className="flex items-center gap-1 font-medium text-[11px] py-0"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-m-success animate-pulse' : 'bg-m-neutral-400'
            }`}
          />
          {isConnected ? 'Connected' : state.status}
        </Badge>

        {collapsible && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="ml-1 text-m-text-muted hover:text-m-text flex items-center gap-0.5 outline-none"
            aria-expanded={isOpen}
            aria-label="Toggle search engine details"
          >
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 p-3.5 rounded-m-xl border border-m-border bg-m-surface shadow-m-panel text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-m-border/60 pb-2">
            <span className="font-semibold text-m-text">Configuration</span>
            <span className="text-[11px] text-m-success flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Search-only
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-m-text-muted block">Provider</span>
              <span className="font-medium text-m-text">{state.providerName}</span>
            </div>
            <div>
              <span className="text-m-text-muted block">Mode</span>
              <span className="font-medium text-m-text">{state.searchMode}</span>
            </div>
            <div className="col-span-2">
              <span className="text-m-text-muted block">Index Name</span>
              <span className="font-mono text-m-text truncate block bg-m-surface-2 px-1.5 py-0.5 rounded border border-m-border/40">
                {state.indexName || 'Not configured'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
