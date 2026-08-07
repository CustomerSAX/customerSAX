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

const INITIAL_GROUPS: CustomerGroup[] = [
  { id: "grp-retail", key: "retail", name: "Retail Buyers" },
  { id: "grp-wholesale", key: "wholesale", name: "Wholesale Accounts" },
  { id: "grp-vip", key: "vip", name: "VIP Gold Tier" },
  { id: "grp-b2b", key: "b2b", name: "B2B Enterprise" },
];

export const INITIAL_CARTS = {
  "cust-101": [
    {
      id: "CRT-881",
      cartState: "Active",
      orderNumber: "--",
      totalPrice: "$184.20",
      lineItemsCount: 4,
      createdAt: "2026-08-05",
      currency: "USD",
      country: "US",
    },
  ],
};

export const INITIAL_ORDERS = {
  "cust-101": [
    {
      id: "ORD-54019",
      orderNumber: "ORD-54019",
      orderState: "Processing",
      paymentState: "Paid",
      totalPrice: "$342.20",
      itemsCount: 4,
      createdAt: "2026-08-05",
    },
    {
      id: "ORD-53982",
      orderNumber: "ORD-53982",
      orderState: "Delivered",
      paymentState: "Paid",
      totalPrice: "$128.50",
      itemsCount: 2,
      createdAt: "2026-07-18",
    },
    {
      id: "ORD-53410",
      orderNumber: "ORD-53410",
      orderState: "Delivered",
      paymentState: "Paid",
      totalPrice: "$64.00",
      itemsCount: 1,
      createdAt: "2026-06-02",
    },
  ],
};

export const INITIAL_RETURNS = {
  "cust-101": [
    {
      id: "ret-1",
      orderNumber: "ORD-53982",
      returnTrackingId: "RET-TRK-90041",
      returnDate: "2026-07-22",
      itemsCount: 1,
      items: [
        {
          id: "ret-item-1",
          quantity: 1,
          shipmentState: "Returned",
          paymentState: "Refunded",
          createdAt: "2026-07-22 10:30 AM",
          lastModifiedAt: "2026-07-24 02:15 PM",
          comment: "Size was smaller than expected.",
        },
      ],
    },
  ],
};

export const INITIAL_QUOTES = {
  "cust-101": [
    {
      id: "QTE-2041",
      quoteKey: "Q-NORTH-2026",
      quoteState: "Accepted",
      totalPrice: "$1,450.00",
      validUntil: "2026-09-30",
      createdAt: "2026-07-01",
    },
  ],
};

export const INITIAL_PAYMENTS = {
  "cust-101": [
    {
      id: "PAY-9041",
      method: "Credit Card (Visa ending in 4242)",
      amount: "$342.20",
      status: "Success",
      createdAt: "2026-08-05",
    },
    {
      id: "PAY-8821",
      method: "Credit Card (Visa ending in 4242)",
      amount: "$128.50",
      status: "Success",
      createdAt: "2026-07-18",
    },
  ],
};

export const INITIAL_TICKETS = {
  "cust-101": [
    {
      id: "TCK-4019",
      ticketNumber: "TCK-4019",
      subject: "Inquiry regarding shipment delay for ORD-54019",
      status: "In Progress" as const,
      priority: "High" as const,
      createdAt: "2026-08-06 11:20 AM",
    },
  ],
};

export const INITIAL_MESSAGES = {
  "cust-101": [
    {
      id: "msg-1",
      sender: "customer" as const,
      senderName: "Mia Johnson",
      content: "Hello, could you please confirm when ORD-54019 will be shipped?",
      createdAt: "2026-08-06 11:20 AM",
      orderNumber: "ORD-54019",
    },
    {
      id: "msg-2",
      sender: "agent" as const,
      senderName: "Support Agent (John)",
      content: "Hi Mia! Your order is currently being prepared for dispatch and is scheduled to leave our warehouse by end of day today.",
      createdAt: "2026-08-06 11:45 AM",
      orderNumber: "ORD-54019",
    },
  ],
};

export const INITIAL_PROMOTIONS = [
  {
    id: "promo-1",
    name: "Summer Tier Discount 15%",
    key: "SUMMER15",
    discount: "15%",
    requiresDiscountCode: true,
    segmentVisible: true,
    validFrom: "2026-06-01",
    validUntil: "2026-08-31",
    isActive: true,
  },
  {
    id: "promo-2",
    name: "VIP Gold Free Shipping",
    key: "VIPFREESHIP",
    discount: "$0 Shipping",
    requiresDiscountCode: false,
    segmentVisible: true,
    validFrom: "2026-01-01",
    validUntil: "2026-12-31",
    isActive: true,
  },
];

export const INITIAL_ASSIGNED_PROMOTIONS = {
  "cust-101": [INITIAL_PROMOTIONS[1]],
};

export const INITIAL_PROMOTION_USAGE = {
  "cust-101": [
    {
      id: "usg-1",
      orderNumber: "ORD-53982",
      couponCode: "VIPFREESHIP",
      promotionName: "VIP Gold Free Shipping",
      state: "Applied",
      usedAt: "2026-07-18",
    },
  ],
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

    return grouped.size > 0 ? Array.from(grouped.values()) : INITIAL_GROUPS;
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
