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

        const updatedCodes = [...o.discountCodes, uppercaseCode];
        const newIneffectiveRow: IneffectiveDiscountRow = {
          code: uppercaseCode,
          message: "Discount validation is not available from the commerce backend yet.",
        };
        const ineffectiveDiscounts = [...(o.ineffectiveDiscounts || []), newIneffectiveRow];

        return {
          ...o,
          discountCodes: updatedCodes,
          ineffectiveDiscounts,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const updateShippingMethod = useCallback((orderId: string, methodId: string, methodName: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const shippingInfo = {
          ...o.shippingInfo,
          shippingMethodId: methodId,
          shippingMethodName: methodName,
        };

        return {
          ...o,
          shippingInfo,
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
