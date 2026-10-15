"use client";

import { useQuery } from "@apollo/client";
import { SALES_CUSTOMER_ORDERS_QUERY } from "../api/queries";
import type {
  CustomerOrdersData,
  CustomerOrdersVariables,
  SalesOrder
} from "../types/order-types";

export interface UseCustomerOrdersOptions {
  customerId?: string;
  customerEmail?: string;
  limit?: number;
  offset?: number;
  skip?: boolean;
}

/**
 * Hook for querying customer orders via Apollo Client,
 * adhering to the patterns used across Customer CX Studio features.
 * Provides data, loading, error, and refetch capabilities.
 */
export function useCustomerOrders({
  customerId,
  customerEmail,
  limit = 20,
  offset = 0,
  skip = false
}: UseCustomerOrdersOptions = {}) {
  const { data, loading, error, refetch } = useQuery<
    CustomerOrdersData,
    CustomerOrdersVariables
  >(SALES_CUSTOMER_ORDERS_QUERY, {
    skip: skip || (!customerId && !customerEmail),
    fetchPolicy: "cache-and-network",
    variables: {
      customerId,
      customerEmail,
      limit,
      offset
    }
  });

  const orders: SalesOrder[] = data?.orderPage?.results ?? [];
  const total = data?.orderPage?.total ?? 0;

  return {
    orders,
    total,
    loading,
    error,
    refetch
  };
}
