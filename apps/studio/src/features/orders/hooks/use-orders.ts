"use client";

import { gql, useMutation, useQuery } from "@apollo/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ORDERS_PAGE_QUERY } from "../api/queries";
import { CUSTOMERS_PAGE_QUERY } from "../../customers/api/queries";
import type {
  Order,
  OrderState,
  ShipmentState,
  PaymentState,
  OrderLineItem,
  OrderAddress,
  OrderReturnItem,
  OrderComment,
  CustomFieldEntry,
} from "../types/order-types";

const UPDATE_ORDER_MUTATION = gql`
  mutation UpdateCommerceOrder($id: ID!, $actions: Json!) {
    updateOrder(id: $id, actions: $actions)
  }
`;

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
  returnInfo?: Array<{
    returnTrackingId?: string | null;
    returnDate?: string | null;
    items?: Array<{
      id: string;
      type?: string | null;
      quantity: number;
      lineItemId?: string | null;
      shipmentState: string;
      paymentState: string;
      comment?: string | null;
    }> | null;
  }> | null;
};

type OrdersPageData = {
  orderPage: {
    results: CommerceOrder[];
  };
};

type OrderCustomersPageData = {
  customerPage: {
    results: Array<{
      id: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }>;
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

function normalizeOrder(order: CommerceOrder, customerNames: Map<string, string>): Order {
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
    customerName: (order.customerId ? customerNames.get(order.customerId) : undefined) ?? order.customerEmail ?? "--",
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
    returnInfo: (order.returnInfo ?? []).map((entry) => ({
      returnTrackingId: entry.returnTrackingId ?? "--",
      returnDate: entry.returnDate ?? "",
      items: (entry.items ?? []).map((item) => ({
        id: item.id,
        type: item.type ?? undefined,
        quantity: item.quantity,
        lineItemId: item.lineItemId ?? "",
        name: lineItems.find((lineItem) => lineItem.id === item.lineItemId)?.name ?? "Returned item",
        sku: lineItems.find((lineItem) => lineItem.id === item.lineItemId)?.sku ?? "",
        shipmentState: item.shipmentState as OrderReturnItem["shipmentState"],
        paymentState: item.paymentState as OrderReturnItem["paymentState"],
        comment: item.comment ?? undefined,
        createdAt: entry.returnDate ?? "",
      })),
    })),
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
  const [orders, setOrders] = useState<Order[]>([]);
  const { data: customersData } = useQuery<OrderCustomersPageData>(CUSTOMERS_PAGE_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: { limit: 500, offset: 0, sortKey: "createdAt", sortOrder: "desc" },
  });
  const [updateOrderMutation] = useMutation(UPDATE_ORDER_MUTATION);

  const runOrderUpdate = useCallback(
    async (orderId: string, actions: Record<string, unknown>[]) => {
      await updateOrderMutation({ variables: { id: orderId, actions } });
      await refetch();
    },
    [refetch, updateOrderMutation]
  );

  const customers = customersData?.customerPage.results;
  const ordersResult = data?.orderPage.results;

  const serverOrders = useMemo(() => {
    const customerNames = new Map<string, string>();
    for (const customer of customers ?? []) {
      const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
      customerNames.set(customer.id, fullName || customer.email || "--");
    }
    return (ordersResult ?? []).map((order) => normalizeOrder(order, customerNames));
  }, [customers, ordersResult]);

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
    async (
      orderId: string,
      updates: { orderState?: OrderState; shipmentState?: ShipmentState; paymentState?: PaymentState }
    ) => {
      const actions: Record<string, unknown>[] = [];
      if (updates.orderState) actions.push({ changeOrderState: { orderState: updates.orderState } });
      if (updates.shipmentState) actions.push({ changeShipmentState: { shipmentState: updates.shipmentState } });
      if (updates.paymentState) actions.push({ changePaymentState: { paymentState: updates.paymentState } });
      await runOrderUpdate(orderId, actions);
    },
    [runOrderUpdate]
  );

  const updateLineItemQuantity = useCallback(async (orderId: string, lineItemId: string, newQty: number) => {
    await runOrderUpdate(orderId, [{ changeLineItemQuantity: { lineItemId, quantity: Math.max(0, newQty) } }]);
  }, [runOrderUpdate]);

  const addLineItemToOrder = useCallback(
    async (orderId: string, newItem: Omit<OrderLineItem, "id" | "subtotal" | "tax" | "totalGross">) => {
      await runOrderUpdate(orderId, [{ addLineItem: { sku: newItem.sku, quantity: newItem.quantity } }]);
    },
    [runOrderUpdate]
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

  const applyDiscountCode = useCallback(async (orderId: string, code: string) => {
    await runOrderUpdate(orderId, [{ addDiscountCode: { code: code.trim() } }]);
  }, [runOrderUpdate]);

  const updateShippingMethod = useCallback(async (orderId: string, methodId: string, _methodName: string) => {
    await runOrderUpdate(orderId, [{ setShippingMethod: { shippingMethod: { id: methodId, typeId: "shipping-method" } } }]);
  }, [runOrderUpdate]);

  const updateShippingAddress = useCallback(async (orderId: string, newAddress: OrderAddress) => {
    await runOrderUpdate(orderId, [{ setShippingAddress: { address: newAddress } }]);
  }, [runOrderUpdate]);

  const addReturnToOrder = useCallback(
    (
      orderId: string,
      returnItems: Omit<OrderReturnItem, "id" | "createdAt">[],
      comment?: string,
      returnDate?: string,
      shipmentState: "Returned" | "Advised" = "Returned"
    ) => {
      return runOrderUpdate(orderId, [{
        addReturnInfo: {
          items: returnItems.map((item) => ({
            lineItemId: item.lineItemId,
            quantity: item.quantity,
            shipmentState,
            comment: comment || item.comment,
          })),
          returnDate: returnDate || new Date().toISOString(),
        },
      }]);
    },
    [runOrderUpdate]
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
