"use client";

import { gql, useMutation, useQuery } from "@apollo/client";
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

const CREATE_CUSTOMER_MUTATION = gql`
  mutation CreateCustomer($draft: Json!) {
    createCustomer(draft: $draft) {
      id customerNumber externalId key email firstName lastName companyName
      customerGroup { id key name }
      version createdAt lastModifiedAt
    }
  }
`;

const UPDATE_CUSTOMER_PROFILE_MUTATION = gql`
  mutation UpdateCustomerProfile($id: ID!, $draft: Json!) {
    updateCustomerProfile(id: $id, draft: $draft) {
      id email firstName lastName companyName customerGroup { id key name } version lastModifiedAt
    }
  }
`;

type CreateCustomerData = { createCustomer: CustomerPageResult | null };
type NewCustomer = Omit<Customer, "id" | "createdAt"> & { password: string };

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
  const [createCustomerMutation] = useMutation<CreateCustomerData>(CREATE_CUSTOMER_MUTATION);
  const [updateCustomerProfileMutation] = useMutation(UPDATE_CUSTOMER_PROFILE_MUTATION);

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

  const addCustomer = useCallback(async (newCustomerData: NewCustomer) => {
    const { password, addresses = [], customerGroup, ...profile } = newCustomerData;
    const draftAddresses = addresses.map(({ id: _id, isShipping: _isShipping, isBilling: _isBilling, isDefaultShipping: _isDefaultShipping, isDefaultBilling: _isDefaultBilling, ...address }) => address);
    const result = await createCustomerMutation({
      variables: {
        draft: {
          email: profile.email.trim(),
          password,
          ...(profile.firstName?.trim() ? { firstName: profile.firstName.trim() } : {}),
          ...(profile.lastName?.trim() ? { lastName: profile.lastName.trim() } : {}),
          ...(profile.companyName?.trim() ? { companyName: profile.companyName.trim() } : {}),
          ...(profile.customerNumber?.trim() ? { customerNumber: profile.customerNumber.trim() } : {}),
          ...(profile.externalId?.trim() ? { externalId: profile.externalId.trim() } : {}),
          ...(customerGroup?.id ? { customerGroup: { id: customerGroup.id } } : {}),
          ...(draftAddresses.length > 0
            ? { addresses: draftAddresses, defaultShippingAddress: 0, defaultBillingAddress: 0 }
            : {}),
        },
      },
      refetchQueries: [{ query: CUSTOMERS_PAGE_QUERY, variables: {
        limit: 100, offset: 0, sortKey: "createdAt", sortOrder: "desc",
      } }],
      awaitRefetchQueries: true,
    });
    const created = result.data?.createCustomer;
    if (!created) throw new Error("The commerce service did not return the created customer.");
    return {
      ...newCustomerData,
      ...created,
      email: created.email ?? newCustomerData.email,
      createdAt: created.createdAt ?? "",
      addresses,
    } satisfies Customer;
  }, [createCustomerMutation]);

  const updateCustomerProfile = useCallback(async (id: string, updates: Partial<Customer>) => {
    const result = await updateCustomerProfileMutation({ variables: { id, draft: {
      ...(updates.firstName !== undefined ? { firstName: updates.firstName } : {}),
      ...(updates.lastName !== undefined ? { lastName: updates.lastName } : {}),
      ...(updates.email !== undefined ? { email: updates.email } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      ...(updates.companyName !== undefined ? { companyName: updates.companyName } : {}),
      ...(updates.customerGroup?.id ? { customerGroup: { id: updates.customerGroup.id } } : {}),
    } } });
    if (!result.data?.updateCustomerProfile) throw new Error("The commerce service did not return the updated customer.");
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
    await refetch();
  }, [refetch, updateCustomerProfileMutation]);

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
