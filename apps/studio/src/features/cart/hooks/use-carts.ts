"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  Cart,
  CartState,
  CartLineItem,
  CartAddress,
} from "../types/cart-types";

type ApiMoney = {
  centAmount?: number | null;
  currencyCode?: string | null;
  fractionDigits?: number | null;
};

type ApiCartLineItem = {
  id: string;
  productId?: string | null;
  sku?: string | null;
  name?: string | null;
  quantity?: number | null;
  totalPrice?: ApiMoney | null;
};

type ApiCart = {
  id: string;
  key?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
  cartState?: CartState | null;
  currencyCode?: string | null;
  totalPrice?: ApiMoney | null;
  lineItems?: ApiCartLineItem[] | null;
  shippingAddress?: CartAddress | null;
  billingAddress?: CartAddress | null;
};

type ApiCartListResponse = {
  results?: ApiCart[];
};

function moneyToNumber(money?: ApiMoney | null) {
  if (!money || typeof money.centAmount !== "number") return 0;
  return money.centAmount / 10 ** (money.fractionDigits ?? 2);
}

function mapApiCart(cart: ApiCart): Cart {
  const grandTotal = moneyToNumber(cart.totalPrice);
  const currencyCode = cart.currencyCode || cart.totalPrice?.currencyCode || "USD";
  const lineItems = (cart.lineItems ?? []).map((item) => {
    const totalGross = moneyToNumber(item.totalPrice);
    const quantity = item.quantity ?? 0;
    const unitPrice = quantity > 0 ? totalGross / quantity : totalGross;

    return {
      id: item.id,
      productId: item.productId || "",
      name: item.name || "Unnamed line item",
      sku: item.sku || "",
      unitPrice,
      quantity,
      subtotal: totalGross,
      tax: 0,
      totalGross,
    };
  });

  return {
    id: cart.id,
    cartNumber: cart.key || undefined,
    customerId: cart.customerId || undefined,
    customerName: cart.customerId ? `Customer ${cart.customerId}` : "Guest / unassigned",
    customerEmail: cart.customerEmail || "",
    store: "",
    currencyCode,
    createdAt: cart.createdAt || "",
    lastModifiedAt: cart.lastModifiedAt || "",
    cartState: cart.cartState || "Unknown",
    lineItems,
    shippingAddress: cart.shippingAddress ?? undefined,
    billingAddress: cart.billingAddress ?? undefined,
    shippingInfo: {
      shippingMethodName: "",
      price: 0,
      taxRate: "",
      carrier: "",
    },
    discountCodes: [],
    appliedDiscounts: [],
    ineffectiveDiscounts: [],
    netTotal: grandTotal,
    taxTotal: 0,
    shippingTotal: 0,
    discountTotal: 0,
    grandTotal,
  };
}

export function useCartStore() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadCarts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/carts?limit=100");
      const payload = (await response.json().catch(() => ({}))) as ApiCartListResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || `Failed to load carts (${response.status})`);
      }

      setCarts((payload.results ?? []).map(mapApiCart));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load carts.";
      setError(message);
      setCarts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void reloadCarts();
    });
  }, [reloadCarts]);

  const getCartById = useCallback(
    (id: string) => carts.find((c) => c.id === id || c.cartNumber === id),
    [carts]
  );

  const updateLineItemQuantity = useCallback((cartId: string, lineItemId: string, newQty: number) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;

        let updatedItems: CartLineItem[];
        if (newQty <= 0) {
          updatedItems = c.lineItems.filter((li) => li.id !== lineItemId);
        } else {
          updatedItems = c.lineItems.map((li) => {
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
        const grandTotal = Math.max(0, netTotal + taxTotal + c.shippingTotal - c.discountTotal);

        return {
          ...c,
          lineItems: updatedItems,
          netTotal,
          taxTotal,
          grandTotal,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const addLineItemToCart = useCallback(
    (cartId: string, newItem: Omit<CartLineItem, "id" | "subtotal" | "tax" | "totalGross">) => {
      setCarts((prev) =>
        prev.map((c) => {
          if (c.id !== cartId && c.cartNumber !== cartId) return c;

          const subtotal = Number((newItem.unitPrice * newItem.quantity).toFixed(2));
          const tax = Number((subtotal * 0.08).toFixed(2));
          const fullItem: CartLineItem = {
            ...newItem,
            id: `cli-${Date.now()}`,
            subtotal,
            tax,
            totalGross: subtotal + tax,
          };

          const updatedItems = [...c.lineItems, fullItem];
          const netTotal = updatedItems.reduce((acc, i) => acc + i.subtotal, 0);
          const taxTotal = updatedItems.reduce((acc, i) => acc + i.tax, 0);
          const grandTotal = Math.max(0, netTotal + taxTotal + c.shippingTotal - c.discountTotal);

          return {
            ...c,
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

  const applyDiscountCode = useCallback((cartId: string, code: string) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;

        const uppercaseCode = code.trim().toUpperCase();
        if (c.discountCodes.includes(uppercaseCode)) {
          return c;
        }

        return {
          ...c,
          discountCodes: [...c.discountCodes, uppercaseCode],
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const updateShippingMethod = useCallback((cartId: string, methodId: string, methodName: string) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;

        const shippingInfo = {
          ...c.shippingInfo,
          shippingMethodId: methodId,
          shippingMethodName: methodName,
        };

        return {
          ...c,
          shippingInfo,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const updateShippingAddress = useCallback((cartId: string, newAddress: CartAddress) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;
        return {
          ...c,
          shippingAddress: newAddress,
          country: newAddress.country || c.country,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const updateBillingAddress = useCallback((cartId: string, newAddress: CartAddress) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;
        return {
          ...c,
          billingAddress: newAddress,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const sendPaymentReminder = useCallback((cartId: string, altEmail?: string): boolean => {
    void altEmail;
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;
        return {
          ...c,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );
    return true;
  }, []);

  const placeOrderFromCart = useCallback((cartId: string): string => {
    const newOrderId = `ord-${Date.now().toString().slice(-4)}`;

    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;
        return {
          ...c,
          cartState: "Ordered" as CartState,
          lastModifiedAt: new Date().toISOString(),
        };
      })
    );

    return newOrderId;
  }, []);

  return {
    carts,
    loading,
    error,
    reloadCarts,
    getCartById,
    updateLineItemQuantity,
    addLineItemToCart,
    applyDiscountCode,
    updateShippingMethod,
    updateShippingAddress,
    updateBillingAddress,
    sendPaymentReminder,
    placeOrderFromCart,
  };
}
