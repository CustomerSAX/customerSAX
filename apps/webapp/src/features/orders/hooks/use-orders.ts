"use client";

import { useQuery } from "@apollo/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ORDERS_PAGE_QUERY } from "../api/queries";
import type {
  Order,
  OrderState,
  ShipmentState,
  PaymentState,
  OrderLineItem,
  OrderAddress,
  OrderReturnItem,
  OrderReturnInfo,
  OrderComment,
  CustomFieldEntry,
  AppliedDiscountRow,
  IneffectiveDiscountRow,
} from "../types/order-types";

type CommerceMoney = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

type CommerceOrderLineItem = {
  id: string;
  name?: string | null;
  productId?: string | null;
  quantity?: number | null;
  sku?: string | null;
  totalPrice?: CommerceMoney | null;
};

type CommerceOrderAddress = {
  streetName?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type CommerceOrder = {
  createdAt?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  id: string;
  lastModifiedAt?: string | null;
  lineItems?: CommerceOrderLineItem[] | null;
  orderNumber?: string | null;
  orderState?: string | null;
  paymentState?: string | null;
  shipmentState?: string | null;
  state?: string | null;
  totalPrice?: CommerceMoney | null;
  shippingAddress?: CommerceOrderAddress | null;
  billingAddress?: CommerceOrderAddress | null;
};

type OrdersPageData = {
  orderPage: {
    results: CommerceOrder[];
  };
};

function moneyToNumber(money?: CommerceMoney | null) {
  if (!money) return 0;
  return money.centAmount / 10 ** money.fractionDigits;
}

function toOrderState(state?: string | null): OrderState {
  if (state === "Open" || state === "Confirmed" || state === "Complete" || state === "Cancelled") {
    return state;
  }

  return "Open";
}

function toShipmentState(state?: string | null): ShipmentState {
  if (
    state === "Shipped" ||
    state === "Ready" ||
    state === "Pending" ||
    state === "Delayed" ||
    state === "Partial" ||
    state === "Backorder"
  ) {
    return state;
  }

  return "Pending";
}

function toPaymentState(state?: string | null): PaymentState {
  if (
    state === "Paid" ||
    state === "Pending" ||
    state === "BalanceDue" ||
    state === "Failed" ||
    state === "CreditOwed"
  ) {
    return state;
  }

  return "Pending";
}

function normalizeOrder(order: CommerceOrder): Order {
  const lineItems = (order.lineItems ?? []).map((item) => {
    const total = moneyToNumber(item.totalPrice);
    const quantity = item.quantity ?? 0;
    const unitPrice = quantity > 0 ? total / quantity : total;

    return {
      id: item.id,
      productId: item.productId ?? "",
      name: item.name ?? item.sku ?? item.id,
      sku: item.sku ?? "",
      unitPrice,
      quantity,
      subtotal: total,
      tax: 0,
      totalGross: total,
    };
  });
  const grandTotal = moneyToNumber(order.totalPrice);

  // Map a CT address to the OrderAddress shape used by the UI. Falls back to
  // "--" only when the field is genuinely absent from the CT record — never
  // fabricates data.
  const mapAddress = (addr?: CommerceOrderAddress | null) => ({
    streetName: addr?.streetName ?? "--",
    streetNumber: addr?.streetNumber ?? undefined,
    city: addr?.city ?? "--",
    state: addr?.state ?? "--",
    postalCode: addr?.postalCode ?? "--",
    country: addr?.country ?? "--",
  });

  return {
    billingAddress: mapAddress(order.billingAddress),
    comments: [],
    createdAt: order.createdAt ?? "",
    customerEmail: order.customerEmail ?? "",
    customerId: order.customerId ?? undefined,
    customerName: order.customerEmail ?? order.customerId ?? "--",
    discountCodes: [],
    discountTotal: 0,
    grandTotal,
    id: order.id,
    lastModifiedAt: order.lastModifiedAt ?? order.createdAt ?? "",
    lineItems,
    netTotal: grandTotal,
    orderNumber: order.orderNumber ?? order.id,
    orderState: toOrderState(order.orderState ?? order.state),
    paymentState: toPaymentState(order.paymentState),
    payments: [],
    returnInfo: [],
    shipmentState: toShipmentState(order.shipmentState),
    shippingAddress: mapAddress(order.shippingAddress),
    shippingInfo: {
      shippingMethodName: "--",
      price: 0,
      taxRate: "--",
      carrier: "--",
      parcels: [],
    },
    shippingTotal: 0,
    store: "--",
    taxTotal: 0,
  };
}

export const MOCK_AVAILABLE_DISCOUNTS = [
  { code: "SUMMER15", name: "Summer Sale 15% Off", value: "15% off cart subtotal", minAmount: 100 },
  { code: "FREESHIP", name: "Free Standard Shipping", value: "$25.00 shipping credit", minAmount: 50 },
  { code: "WINTER10", name: "Winter Promo $10", value: "$10.00 direct credit", minAmount: 20 },
  { code: "VIP20", name: "VIP Executive Member 20%", value: "20% off whole order", minAmount: 200 },
  { code: "EXPIRED99", name: "Legacy Discount Code", value: "Expired", minAmount: 999 },
];

export const MOCK_SHIPPING_METHODS = [
  { id: "sm-fedex-express", name: "FedEx Express 2-Day Delivery", price: 25.0, carrier: "FedEx" },
  { id: "sm-ups-ground", name: "UPS Standard Ground", price: 15.0, carrier: "UPS" },
  { id: "sm-usps-priority", name: "USPS Priority Mail", price: 10.0, carrier: "USPS" },
  { id: "sm-dhl-overnight", name: "DHL Express Overnight", price: 45.0, carrier: "DHL" },
];

export const MOCK_CATALOG_PRODUCTS = [
  {
    productId: "prod-101",
    name: "Ergonomic Mesh Office Chair (Black)",
    sku: "OFF-CHR-001",
    key: "mesh-chair-blk",
    unitPrice: 249.99,
    imageUrl: "https://images.unsplash.com/photo-1580481072645-022f9a6d1270?w=150&auto=format&fit=crop",
  },
  {
    productId: "prod-102",
    name: "Ultra-Wide 34\" Curved Monitor 144Hz",
    sku: "MON-UW34-09",
    key: "ultrawide-34",
    unitPrice: 599.99,
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=150&auto=format&fit=crop",
  },
  {
    productId: "prod-103",
    name: "Wireless Noise-Canceling Headphones",
    sku: "AUD-ANC-900",
    key: "anc-headphones",
    unitPrice: 199.99,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&auto=format&fit=crop",
  },
  {
    productId: "prod-104",
    name: "Mechanical Gaming Keyboard RGB",
    sku: "KB-MECH-88",
    key: "mech-keyboard",
    unitPrice: 129.99,
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=150&auto=format&fit=crop",
  },
  {
    productId: "prod-105",
    name: "4K USB-C Webcam with Ring Light",
    sku: "CAM-4K-RING",
    key: "webcam-4k",
    unitPrice: 89.99,
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=150&auto=format&fit=crop",
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: "ord-101",
    orderNumber: "ORD-54019",
    customerId: "cust-101",
    customerName: "Mia Johnson",
    customerEmail: "mia.johnson@example.com",
    companyName: "Northwind Retail",
    store: "US Flagship Store",
    createdAt: "2026-08-05T14:30:00Z",
    lastModifiedAt: "2026-08-06T10:15:00Z",
    orderState: "Confirmed",
    shipmentState: "Ready",
    paymentState: "Paid",
    lineItems: [
      {
        id: "li-101",
        productId: "prod-101",
        key: "mesh-chair-blk",
        name: "Ergonomic Mesh Office Chair (Black)",
        sku: "OFF-CHR-001",
        imageUrl: "https://images.unsplash.com/photo-1580481072645-022f9a6d1270?w=150&auto=format&fit=crop",
        unitPrice: 249.99,
        quantity: 1,
        subtotal: 249.99,
        tax: 20.0,
        totalGross: 269.99,
      },
      {
        id: "li-102",
        productId: "prod-102",
        key: "ultrawide-34",
        name: "Ultra-Wide 34\" Curved Monitor 144Hz",
        sku: "MON-UW34-09",
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=150&auto=format&fit=crop",
        unitPrice: 599.99,
        quantity: 1,
        subtotal: 599.99,
        tax: 48.0,
        totalGross: 647.99,
      },
    ],
    shippingAddress: {
      streetNumber: "742",
      streetName: "Evergreen Terrace",
      building: "Apt 4B",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      country: "US",
    },
    billingAddress: {
      streetNumber: "742",
      streetName: "Evergreen Terrace",
      building: "Apt 4B",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      country: "US",
    },
    shippingInfo: {
      shippingMethodId: "sm-fedex-express",
      shippingMethodName: "FedEx Express 2-Day Delivery",
      price: 25.0,
      taxRate: "8.0%",
      carrier: "FedEx",
      parcels: [
        {
          id: "prc-1",
          trackingId: "TRK-900812344",
          carrier: "FedEx Express",
          itemsCount: 2,
          shippedAt: "2026-08-06T09:00:00Z",
        },
      ],
    },
    returnInfo: [],
    payments: [
      {
        id: "pay-101",
        interfaceId: "pi_3M000000000001",
        method: "Credit Card (Visa ending 4242)",
        psp: "Stripe",
        amountPlanned: 942.98,
        pspPaymentStatus: "succeeded",
        paymentLink: "https://checkout.stripe.com/pay/cs_live_101",
        createdAt: "2026-08-05T14:30:00Z",
        lastModifiedAt: "2026-08-05T14:32:00Z",
        transactions: [
          {
            id: "txn-101",
            timestamp: "2026-08-05T14:30:00Z",
            type: "Charge",
            state: "Success",
            amount: 942.98,
            interactionId: "ch_3M000000000001",
          },
        ],
      },
    ],
    comments: [
      {
        id: "cmt-1",
        text: "Customer requested expedited shipping confirmation via phone.",
        author: "John Agent",
        createdAt: "2026-08-05T15:00:00Z",
      },
    ],
    giftMessage: "Happy Anniversary! Enjoy your new home office setup.",
    discountCodes: ["SUMMER15", "FREESHIP"],
    appliedDiscounts: [
      { code: "SUMMER15", name: "Summer Sale 15% Off", value: "15% off subtotal", savings: "$127.50" },
      { code: "FREESHIP", name: "Free Standard Shipping", value: "Free shipping", savings: "$25.00" },
    ],
    ineffectiveDiscounts: [],
    customFields: [
      { name: "salesChannel", value: "B2B Portal Online" },
      { name: "approvalStatus", value: "Approved by Finance" },
      { name: "costCenter", value: "CC-9014" },
    ],
    netTotal: 849.98,
    taxTotal: 68.0,
    shippingTotal: 25.0,
    discountTotal: 40.0,
    grandTotal: 902.98,
  },
  {
    id: "ord-102",
    orderNumber: "ORD-53982",
    customerId: "cust-102",
    customerName: "Alex Chen",
    customerEmail: "alex.chen@apexdigital.com",
    companyName: "Apex Digital Solutions",
    store: "US Flagship Store",
    createdAt: "2026-08-04T10:15:00Z",
    lastModifiedAt: "2026-08-04T16:20:00Z",
    orderState: "Complete",
    shipmentState: "Shipped",
    paymentState: "Paid",
    lineItems: [
      {
        id: "li-201",
        productId: "prod-103",
        key: "anc-headphones",
        name: "Wireless Noise-Canceling Headphones",
        sku: "AUD-ANC-900",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&auto=format&fit=crop",
        unitPrice: 199.99,
        quantity: 2,
        subtotal: 399.98,
        tax: 32.0,
        totalGross: 431.98,
      },
    ],
    shippingAddress: {
      streetNumber: "100",
      streetName: "Market Street, Suite 400",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
    },
    billingAddress: {
      streetNumber: "100",
      streetName: "Market Street, Suite 400",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
    },
    shippingInfo: {
      shippingMethodId: "sm-ups-ground",
      shippingMethodName: "UPS Standard Ground",
      price: 15.0,
      taxRate: "8.0%",
      carrier: "UPS",
      parcels: [
        {
          id: "prc-2",
          trackingId: "1Z9999999999999999",
          carrier: "UPS Ground",
          itemsCount: 2,
          shippedAt: "2026-08-04T16:00:00Z",
        },
      ],
    },
    returnInfo: [],
    payments: [
      {
        id: "pay-102",
        interfaceId: "pi_3M000000000002",
        method: "Corporate ACH / Bank Transfer",
        psp: "Stripe",
        amountPlanned: 446.98,
        pspPaymentStatus: "succeeded",
        createdAt: "2026-08-04T10:15:00Z",
        lastModifiedAt: "2026-08-04T10:15:00Z",
        transactions: [
          {
            id: "txn-102",
            timestamp: "2026-08-04T10:15:00Z",
            type: "Charge",
            state: "Success",
            amount: 446.98,
            interactionId: "ch_3M000000000002",
          },
        ],
      },
    ],
    comments: [],
    discountCodes: [],
    appliedDiscounts: [],
    ineffectiveDiscounts: [],
    customFields: [
      { name: "poNumber", value: "PO-88401" },
      { name: "taxExemptId", value: "TE-CA-99201" },
    ],
    netTotal: 399.98,
    taxTotal: 32.0,
    shippingTotal: 15.0,
    discountTotal: 0,
    grandTotal: 446.98,
  },
  {
    id: "ord-103",
    orderNumber: "ORD-53410",
    customerId: "cust-103",
    customerName: "Sarah Williams",
    customerEmail: "sarah@williamsconsulting.io",
    companyName: "Williams Consulting",
    store: "US Flagship Store",
    createdAt: "2026-07-28T11:00:00Z",
    lastModifiedAt: "2026-07-29T14:00:00Z",
    orderState: "Complete",
    shipmentState: "Shipped",
    paymentState: "Paid",
    lineItems: [
      {
        id: "li-301",
        productId: "prod-104",
        key: "mech-keyboard",
        name: "Mechanical Gaming Keyboard RGB",
        sku: "KB-MECH-88",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=150&auto=format&fit=crop",
        unitPrice: 129.99,
        quantity: 1,
        subtotal: 129.99,
        tax: 10.4,
        totalGross: 140.39,
      },
    ],
    shippingAddress: {
      streetNumber: "500",
      streetName: "Fifth Avenue",
      city: "New York",
      state: "NY",
      postalCode: "10110",
      country: "US",
    },
    billingAddress: {
      streetNumber: "500",
      streetName: "Fifth Avenue",
      city: "New York",
      state: "NY",
      postalCode: "10110",
      country: "US",
    },
    shippingInfo: {
      shippingMethodId: "sm-usps-priority",
      shippingMethodName: "USPS Priority Mail",
      price: 10.0,
      taxRate: "8.0%",
      carrier: "USPS",
      parcels: [],
    },
    returnInfo: [
      {
        returnTrackingId: "RTN-20260729-ORD-53410-1",
        returnDate: "2026-07-29T14:00:00Z",
        items: [
          {
            id: "rti-101",
            lineItemId: "li-301",
            name: "Mechanical Gaming Keyboard RGB",
            sku: "KB-MECH-88",
            key: "mech-keyboard",
            imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=150&auto=format&fit=crop",
            quantity: 1,
            shipmentState: "Returned",
            paymentState: "Refunded",
            comment: "Customer exchanged for silent linear switches.",
            createdAt: "2026-07-29T14:00:00Z",
          },
        ],
      },
    ],
    payments: [
      {
        id: "pay-103",
        interfaceId: "pi_3M000000000003",
        method: "Credit Card (Mastercard ending 8888)",
        psp: "Stripe",
        amountPlanned: 150.39,
        pspPaymentStatus: "succeeded",
        createdAt: "2026-07-28T11:00:00Z",
        lastModifiedAt: "2026-07-29T14:00:00Z",
        transactions: [
          {
            id: "txn-103",
            timestamp: "2026-07-28T11:00:00Z",
            type: "Charge",
            state: "Success",
            amount: 150.39,
            interactionId: "ch_3M000000000003",
          },
          {
            id: "txn-104",
            timestamp: "2026-07-29T14:00:00Z",
            type: "Refund",
            state: "Success",
            amount: 150.39,
            interactionId: "re_3M000000000003",
          },
        ],
      },
    ],
    comments: [
      {
        id: "cmt-2",
        text: "RMA-9012 processed and refund issued.",
        author: "Sarah Jenkins",
        createdAt: "2026-07-29T14:00:00Z",
      },
    ],
    discountCodes: [],
    appliedDiscounts: [],
    ineffectiveDiscounts: [],
    customFields: [],
    netTotal: 129.99,
    taxTotal: 10.4,
    shippingTotal: 10.0,
    discountTotal: 0,
    grandTotal: 150.39,
  },
  {
    id: "ord-104",
    orderNumber: "ORD-53205",
    customerId: "cust-104",
    customerName: "David Miller",
    customerEmail: "d.miller@millerlogistics.com",
    companyName: "Miller Logistics",
    store: "US Flagship Store",
    createdAt: "2026-08-07T08:30:00Z",
    lastModifiedAt: "2026-08-07T08:30:00Z",
    orderState: "Open",
    shipmentState: "Pending",
    paymentState: "BalanceDue",
    lineItems: [
      {
        id: "li-401",
        productId: "prod-105",
        key: "webcam-4k",
        name: "4K USB-C Webcam with Ring Light",
        sku: "CAM-4K-RING",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=150&auto=format&fit=crop",
        unitPrice: 89.99,
        quantity: 3,
        subtotal: 269.97,
        tax: 21.6,
        totalGross: 291.57,
      },
    ],
    shippingAddress: {
      streetNumber: "800",
      streetName: "Industrial Parkway",
      building: "Warehouse 3",
      city: "Chicago",
      state: "IL",
      postalCode: "60601",
      country: "US",
    },
    billingAddress: {
      streetNumber: "800",
      streetName: "Industrial Parkway",
      building: "Warehouse 3",
      city: "Chicago",
      state: "IL",
      postalCode: "60601",
      country: "US",
    },
    shippingInfo: {
      shippingMethodId: "sm-ups-ground",
      shippingMethodName: "UPS Standard Ground",
      price: 15.0,
      taxRate: "8.0%",
      carrier: "UPS",
      parcels: [],
    },
    returnInfo: [],
    payments: [],
    comments: [],
    discountCodes: [],
    appliedDiscounts: [],
    ineffectiveDiscounts: [],
    customFields: [],
    netTotal: 269.97,
    taxTotal: 21.6,
    shippingTotal: 15.0,
    discountTotal: 0,
    grandTotal: 306.57,
  },
];

export function useOrderStore() {
  const { data, error, loading, refetch } = useQuery<OrdersPageData>(ORDERS_PAGE_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: {
      limit: 100,
      offset: 0,
      sortKey: "createdAt",
      sortOrder: "desc",
    },
  });
  const [orders, setOrders] = useState<Order[]>(() =>
    process.env.NEXT_PUBLIC_USE_MOCK_ORDERS === "true" ? INITIAL_ORDERS : []
  );

  const serverOrders = useMemo(() => {
    return (data?.orderPage.results ?? []).map(normalizeOrder);
  }, [data?.orderPage.results]);

  useEffect(() => {
    if (serverOrders.length > 0) {
      setOrders(serverOrders);
    }
  }, [serverOrders]);

  const getOrderById = useCallback(
    (id: string) => orders.find((o) => o.id === id || o.orderNumber === id),
    [orders]
  );

  const updateOrderStates = useCallback(
    (
      orderId: string,
      updates: { orderState?: OrderState; shipmentState?: ShipmentState; paymentState?: PaymentState }
    ) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId && o.orderNumber !== orderId) return o;
          return {
            ...o,
            ...updates,
            lastModifiedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const updateLineItemQuantity = useCallback((orderId: string, lineItemId: string, newQty: number) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;

        let updatedItems: OrderLineItem[];
        if (newQty <= 0) {
          updatedItems = o.lineItems.filter((li) => li.id !== lineItemId);
        } else {
          updatedItems = o.lineItems.map((li) => {
            if (li.id !== lineItemId) return li;
            const subtotal = Number((li.unitPrice * newQty).toFixed(2));
            const tax = Number((subtotal * 0.08).toFixed(2));
            return {
              ...li,
              quantity: newQty,
              subtotal,
              tax,
              totalGross: subtotal + tax,
            };
          });
        }

        const netTotal = updatedItems.reduce((acc, i) => acc + i.subtotal, 0);
        const taxTotal = updatedItems.reduce((acc, i) => acc + i.tax, 0);
        const grandTotal = netTotal + taxTotal + o.shippingTotal - o.discountTotal;

        return {
          ...o,
          lineItems: updatedItems,
          netTotal,
          taxTotal,
          grandTotal,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const addLineItemToOrder = useCallback(
    (orderId: string, newItem: Omit<OrderLineItem, "id" | "subtotal" | "tax" | "totalGross">) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId && o.orderNumber !== orderId) return o;

          const subtotal = Number((newItem.unitPrice * newItem.quantity).toFixed(2));
          const tax = Number((subtotal * 0.08).toFixed(2));
          const fullItem: OrderLineItem = {
            ...newItem,
            id: `li-${Date.now()}`,
            subtotal,
            tax,
            totalGross: subtotal + tax,
          };

          const updatedItems = [...o.lineItems, fullItem];
          const netTotal = updatedItems.reduce((acc, i) => acc + i.subtotal, 0);
          const taxTotal = updatedItems.reduce((acc, i) => acc + i.tax, 0);
          const grandTotal = netTotal + taxTotal + o.shippingTotal - o.discountTotal;

          return {
            ...o,
            lineItems: updatedItems,
            netTotal,
            taxTotal,
            grandTotal,
            lastModifiedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const duplicateOrder = useCallback(
    (orderId: string): string => {
      const order = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
      const newCartId = `cart-new-${order?.id || Date.now()}`;
      return newCartId;
    },
    [orders]
  );

  const sendPaymentReminder = useCallback((orderId: string, altEmail: string): boolean => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const newComment: OrderComment = {
          id: `cmt-${Date.now()}`,
          text: `Automated payment reminder email sent to ${altEmail || o.customerEmail}`,
          author: "System (Automation)",
          createdAt: new Date().toISOString(),
        };
        return {
          ...o,
          comments: [...o.comments, newComment],
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
    return true;
  }, []);

  const redeemLoyaltyPoints = useCallback((orderId: string, points: number): number => {
    const dollars = points / 1000;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const discountTotal = o.discountTotal + dollars;
        const grandTotal = Math.max(0, o.netTotal + o.taxTotal + o.shippingTotal - discountTotal);
        return {
          ...o,
          discountTotal,
          grandTotal,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
    return dollars;
  }, []);

  const saveGiftMessage = useCallback((orderId: string, giftMessage: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        return {
          ...o,
          giftMessage,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const applyDiscountCode = useCallback((orderId: string, code: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;

        const uppercaseCode = code.trim().toUpperCase();
        if (o.discountCodes.includes(uppercaseCode)) {
          return o;
        }

        const match = MOCK_AVAILABLE_DISCOUNTS.find((d) => d.code === uppercaseCode);
        const updatedCodes = [...o.discountCodes, uppercaseCode];

        if (match && match.code !== "EXPIRED99") {
          const newAppliedRow: AppliedDiscountRow = {
            code: match.code,
            name: match.name,
            value: match.value,
            savings: "$15.00",
          };
          const appliedDiscounts = [...(o.appliedDiscounts || []), newAppliedRow];
          const discountTotal = o.discountTotal + 15.0;
          const grandTotal = Math.max(0, o.netTotal + o.taxTotal + o.shippingTotal - discountTotal);

          return {
            ...o,
            discountCodes: updatedCodes,
            appliedDiscounts,
            discountTotal,
            grandTotal,
            lastModifiedAt: new Date().toISOString(),
          };
        } else {
          const newIneffectiveRow: IneffectiveDiscountRow = {
            code: uppercaseCode,
            message: match ? "Discount code has expired or minimum cart requirements were not met." : "Invalid or unrecognized promotional code.",
          };
          const ineffectiveDiscounts = [...(o.ineffectiveDiscounts || []), newIneffectiveRow];

          return {
            ...o,
            discountCodes: updatedCodes,
            ineffectiveDiscounts,
            lastModifiedAt: new Date().toISOString(),
          };
        }
      })
    );
  }, []);

  const updateShippingMethod = useCallback((orderId: string, methodId: string, methodName: string) => {
    const selectedMethod = MOCK_SHIPPING_METHODS.find((m) => m.id === methodId) || {
      id: methodId,
      name: methodName,
      price: 15.0,
      carrier: "Standard",
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const shippingInfo = {
          ...o.shippingInfo,
          shippingMethodId: selectedMethod.id,
          shippingMethodName: selectedMethod.name,
          price: selectedMethod.price,
          carrier: selectedMethod.carrier,
        };
        const grandTotal = o.netTotal + o.taxTotal + selectedMethod.price - o.discountTotal;

        return {
          ...o,
          shippingInfo,
          shippingTotal: selectedMethod.price,
          grandTotal,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const updateShippingAddress = useCallback((orderId: string, newAddress: OrderAddress) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        return {
          ...o,
          shippingAddress: newAddress,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const addReturnToOrder = useCallback(
    (
      orderId: string,
      returnItems: Omit<OrderReturnItem, "id" | "createdAt">[],
      comment?: string,
      returnDate?: string,
      shipmentState: "Returned" | "Advised" = "Returned"
    ) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId && o.orderNumber !== orderId) return o;

          const seq = (o.returnInfo?.length || 0) + 1;
          const returnTrackingId = `RTN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${o.orderNumber}-${seq}`;

          const newItems: OrderReturnItem[] = returnItems.map((ri, idx) => ({
            ...ri,
            id: `rti-${Date.now()}-${idx}`,
            shipmentState,
            createdAt: new Date().toISOString(),
            comment: comment || ri.comment,
          }));

          const newReturnEntry: OrderReturnInfo = {
            returnTrackingId,
            returnDate: returnDate || new Date().toISOString(),
            items: newItems,
          };

          return {
            ...o,
            returnInfo: [...(o.returnInfo || []), newReturnEntry],
            lastModifiedAt: new Date().toISOString(),
          };
        })
      );
    },
    []
  );

  const refreshPaymentPspStatus = useCallback((orderId: string, paymentId: string): string => {
    const statuses = ["succeeded", "paid", "authorized"];
    const nextStatus = statuses[Math.floor(Math.random() * statuses.length)];

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const payments = o.payments.map((p) => {
          if (p.id !== paymentId) return p;
          return {
            ...p,
            pspPaymentStatus: nextStatus,
            lastModifiedAt: new Date().toISOString(),
          };
        });
        return {
          ...o,
          payments,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
    return nextStatus;
  }, []);

  const sendPaymentLink = useCallback((orderId: string, paymentId: string, _customerId?: string): boolean => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const newComment: OrderComment = {
          id: `cmt-${Date.now()}`,
          text: `Payment link re-sent to customer (${o.customerEmail}) for payment ID ${paymentId}`,
          author: "System (PSP Integration)",
          createdAt: new Date().toISOString(),
        };
        return {
          ...o,
          comments: [...o.comments, newComment],
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
    return true;
  }, []);

  const addOrderComment = useCallback((orderId: string, commentText: string, author = "Support Agent") => {
    const newComment: OrderComment = {
      id: `cmt-${Date.now()}`,
      text: commentText,
      author,
      createdAt: new Date().toISOString(),
    };
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        return {
          ...o,
          comments: [...o.comments, newComment],
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const updateCustomFields = useCallback((orderId: string, fields: CustomFieldEntry[]) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        return {
          ...o,
          customFields: fields,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  return {
    orders,
    error,
    getOrderById,
    loading,
    refetch,
    updateOrderStates,
    updateLineItemQuantity,
    addLineItemToOrder,
    duplicateOrder,
    sendPaymentReminder,
    redeemLoyaltyPoints,
    saveGiftMessage,
    updateGiftMessage: saveGiftMessage,
    applyDiscountCode,
    updateShippingMethod,
    updateShippingAddress,
    addReturnToOrder,
    refreshPaymentPspStatus,
    sendPaymentLink,
    addOrderComment,
    updateCustomFields,
  };
}
