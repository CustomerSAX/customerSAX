"use client";

import { useState, useCallback } from "react";
import type {
  Customer,
  CustomerGroup,
} from "../types/customer-types";

const INITIAL_GROUPS: CustomerGroup[] = [
  { id: "grp-retail", key: "retail", name: "Retail Buyers" },
  { id: "grp-wholesale", key: "wholesale", name: "Wholesale Accounts" },
  { id: "grp-vip", key: "vip", name: "VIP Gold Tier" },
  { id: "grp-b2b", key: "b2b", name: "B2B Enterprise" },
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: "cust-101",
    customerNumber: "CN-90412",
    externalId: "EXT-88219",
    key: "mia-johnson",
    firstName: "Mia",
    lastName: "Johnson",
    companyName: "Northwind Retail",
    email: "mia.johnson@example.com",
    phone: "+1 (555) 234-5678",
    customerGroup: { id: "grp-vip", name: "VIP Gold Tier", key: "vip" },
    segment: "VIP Gold",
    version: 4,
    createdAt: "2026-01-15T09:30:00Z",
    lastModifiedAt: "2026-08-05T14:22:00Z",
    addresses: [
      {
        id: "addr-1",
        streetName: "Evergreen Terrace",
        streetNumber: "742",
        city: "Springfield",
        state: "OR",
        postalCode: "97477",
        country: "US",
        email: "mia.johnson@example.com",
        phone: "+1 (555) 234-5678",
        isShipping: true,
        isBilling: true,
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
      {
        id: "addr-2",
        streetName: "Commercial Pkwy",
        streetNumber: "1200",
        city: "Eugene",
        state: "OR",
        postalCode: "97401",
        country: "US",
        email: "shipping@northwind.com",
        phone: "+1 (555) 998-1122",
        isShipping: true,
        isBilling: false,
        isDefaultShipping: false,
        isDefaultBilling: false,
      },
    ],
  },
  {
    id: "cust-102",
    customerNumber: "CN-90413",
    externalId: "EXT-88220",
    key: "alex-chen",
    firstName: "Alex",
    lastName: "Chen",
    companyName: "Apex Digital Solutions",
    email: "alex.chen@apexdigital.com",
    phone: "+1 (555) 876-5432",
    customerGroup: { id: "grp-wholesale", name: "Wholesale Accounts", key: "wholesale" },
    segment: "Wholesale",
    version: 2,
    createdAt: "2026-02-20T11:15:00Z",
    lastModifiedAt: "2026-07-29T16:05:00Z",
    addresses: [
      {
        id: "addr-3",
        streetName: "Market Street",
        streetNumber: "500",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
        country: "US",
        email: "alex.chen@apexdigital.com",
        phone: "+1 (555) 876-5432",
        isShipping: true,
        isBilling: true,
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  },
  {
    id: "cust-103",
    customerNumber: "CN-90414",
    externalId: "EXT-88221",
    key: "sarah-williams",
    firstName: "Sarah",
    lastName: "Williams",
    companyName: "Williams Consulting",
    email: "sarah@williamsconsulting.io",
    phone: "+1 (555) 345-6789",
    customerGroup: { id: "grp-retail", name: "Retail Buyers", key: "retail" },
    segment: "Retail",
    version: 1,
    createdAt: "2026-03-10T08:45:00Z",
    lastModifiedAt: "2026-06-12T10:18:00Z",
    addresses: [],
  },
  {
    id: "cust-104",
    customerNumber: "CN-90415",
    externalId: "EXT-88222",
    key: "david-miller",
    firstName: "David",
    lastName: "Miller",
    companyName: "Miller Logistics",
    email: "d.miller@millerlogistics.com",
    phone: "+1 (555) 654-3210",
    customerGroup: { id: "grp-b2b", name: "B2B Enterprise", key: "b2b" },
    segment: "Enterprise",
    version: 5,
    createdAt: "2026-04-05T14:00:00Z",
    lastModifiedAt: "2026-08-01T17:30:00Z",
    addresses: [],
  },
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
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [groups] = useState<CustomerGroup[]>(INITIAL_GROUPS);

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
    setCustomers((prev) => [newCustomer, ...prev]);
    return newCustomer;
  }, []);

  const updateCustomerProfile = useCallback((id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates, lastModifiedAt: new Date().toISOString() } : c))
    );
  }, []);

  return {
    customers,
    groups,
    getCustomerById,
    addCustomer,
    updateCustomerProfile,
  };
}
