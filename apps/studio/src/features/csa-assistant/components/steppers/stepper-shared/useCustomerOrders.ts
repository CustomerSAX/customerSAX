'use client';

import { useEffect, useState } from 'react';

export type CustomerOrderSummary = {
  id: string;
  orderNumber?: string;
  totalPrice?: string;
  createdAt?: string;
  status?: string;
};

type CustomerOrdersResponse = {
  error?: string;
  orders?: CustomerOrderSummary[];
};

/**
 * Fetches a customer's recent orders — same read-only BFF endpoint
 * (`/api/orders?limit=50&customerId=...`) the Orders page uses. Read-only
 * browse only; picking one is a local UI decision until the caller submits
 * it via onAction.
 *
 * Shared by CreateTicketStepper (order-linked ticket categories) and
 * ReturnStepper (picking the order to return/refund) — previously
 * copy-pasted in the former only, extracted here so the latter doesn't
 * reintroduce the same fetch a second time.
 */
export function useCustomerOrders(customerId: string | undefined | null, enabled: boolean) {
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Distinct from "zero orders" — true only when the lookup itself couldn't
  // be completed (backend unreachable), never when it ran fine and the
  // customer genuinely has no orders.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !customerId) {
      queueMicrotask(() => {
        setOrders([]);
        setError(null);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setError(null);
    });
    fetch(`/api/orders?limit=50&customerId=${customerId}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as CustomerOrdersResponse;
        if (cancelled) return;
        if (!res.ok) {
          setOrders([]);
          setError(data?.error || 'Unable to load orders right now.');
          return;
        }
        // NOTE: /api/orders returns { orders: [...] }, not { results: [...] }
        // — reading data.results here always produced an empty list
        // regardless of whether the backend actually had orders.
        setOrders(data.orders || []);
        setError(null);
      })
      .catch((e) => {
        console.error('Failed to fetch orders:', e);
        if (!cancelled) {
          setOrders([]);
          setError('Unable to load orders right now.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, enabled]);

  return { orders, isLoading, error };
}
