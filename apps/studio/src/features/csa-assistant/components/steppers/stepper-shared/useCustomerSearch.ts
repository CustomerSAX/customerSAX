'use client';

import { useEffect, useState } from 'react';

export interface CustomerSearchResult {
  id: string;
  name: string;
  email: string;
  initials: string;
}

/**
 * Debounced customer search against the same BFF endpoint the Customers page
 * uses. Read-only browse/typeahead only — the actual business decision (which
 * customer a workflow is for) is submitted separately via onAction, never
 * decided here.
 *
 * Shared by CreateOrderStepper, CreateTicketStepper, and ReturnStepper — this
 * was previously copy-pasted verbatim in each.
 */
export function useCustomerSearch(query: string) {
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Distinct from "zero results" — true only when the search itself could
  // not be completed (backend unreachable), never when it ran fine and
  // genuinely found nobody. The UI must be able to tell these apart instead
  // of silently showing "no customers found" for a system outage.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/customers/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ option: 'all', text: trimmed, limit: 10, offset: 0 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResults([]);
          setError(data?.error || 'Unable to search customers right now.');
          return;
        }
        // /api/customers/search already returns { id, name, email, initials,
        // ... } directly — it does NOT return firstName/lastName, so
        // reconstructing name/initials from those (as this used to do)
        // always fell through to the fallback branch and showed the
        // customer's email as their "name" with "C" as their initials.
        const mapped: CustomerSearchResult[] = (data.results || []).map((c: any) => ({
          id: c.id,
          name: c.name || c.email || 'Customer',
          email: c.email || '',
          initials: c.initials || (c.name?.[0] || c.email?.[0] || 'C').toUpperCase(),
        }));
        setResults(mapped);
        setError(null);
      } catch (e) {
        console.error('Customer search failed:', e);
        setResults([]);
        setError('Unable to search customers right now.');
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, isLoading, error };
}
