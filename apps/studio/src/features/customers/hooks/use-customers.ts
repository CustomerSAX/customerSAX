"use client";

import { useQuery } from "@apollo/client";
import { useState, useCallback, useMemo } from "react";
import { CUSTOMERS_PAGE_QUERY } from "../api/queries";
import type {
  Customer,
  CustomerGroup,
} from "../types/customer-types";

type CustomerPageResult = Omit<Customer, "createdAt" | "email"> & {
  createdAt?: string | null;
  email?: string | null;
  lastModifiedAt?: string | null;
};

type CustomersPageData = {
  customerPage: {
    results: CustomerPageResult[];
  };
};

export function useCustomerStore() {
  const { data, error, loading, refetch } = useQuery<CustomersPageData>(CUSTOMERS_PAGE_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: {
      limit: 100,
      offset: 0,
      sortKey: "createdAt",
      sortOrder: "desc",
    },
  });
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);
  const [customerOverrides, setCustomerOverrides] = useState<Record<string, Partial<Customer>>>({});

  const serverCustomers = useMemo<Customer[]>(() => {
    return (data?.customerPage.results ?? []).map((customer) => ({
      ...customer,
      email: customer.email ?? "",
      createdAt: customer.createdAt ?? "",
      lastModifiedAt: customer.lastModifiedAt ?? undefined,
    }));
  }, [data?.customerPage.results]);

  const customers = useMemo(() => {
    return [
      ...localCustomers,
      ...serverCustomers.map((customer) => ({
        ...customer,
        ...(customerOverrides[customer.id] ?? {}),
      })),
    ];
  }, [customerOverrides, localCustomers, serverCustomers]);

  const groups = useMemo<CustomerGroup[]>(() => {
    const grouped = new Map<string, CustomerGroup>();

    for (const customer of customers) {
      if (customer.customerGroup?.id) {
        grouped.set(customer.customerGroup.id, {
          id: customer.customerGroup.id,
          key: customer.customerGroup.key,
          name: customer.customerGroup.name ?? customer.customerGroup.key ?? customer.customerGroup.id,
        });
      }
    }

    return Array.from(grouped.values());
  }, [customers]);

  const getCustomerById = useCallback(
    (id: string) => customers.find((c) => c.id === id || c.key === id),
    [customers]
  );

  const addCustomer = useCallback((newCustomerData: Omit<Customer, "id" | "createdAt">) => {
    const id = `cust-${Date.now()}`;
    const newCustomer: Customer = {
      ...newCustomerData,
      id,
      createdAt: new Date().toISOString(),
    };
    setLocalCustomers((prev) => [newCustomer, ...prev]);
    return newCustomer;
  }, []);

  const updateCustomerProfile = useCallback((id: string, updates: Partial<Customer>) => {
    const timestampedUpdates = { ...updates, lastModifiedAt: new Date().toISOString() };

    setLocalCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...timestampedUpdates } : c))
    );
    setCustomerOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        ...timestampedUpdates,
      },
    }));
  }, []);

  return {
    customers,
    error,
    groups,
    getCustomerById,
    addCustomer,
    loading,
    refetch,
    updateCustomerProfile,
  };
}
