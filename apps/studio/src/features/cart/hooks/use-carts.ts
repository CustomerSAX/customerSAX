"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Cart, CartState, CartLineItem, CartAddress } from "../types/cart-types";

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
  shippingInfo?: {
    shippingMethodId?: string | null;
    shippingMethodName?: string | null;
    price?: ApiMoney | null;
  } | null;
  discountCodes?: string[] | null;
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
      totalGross
    };
  });

  const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.totalGross, 0);
  return {
    id: cart.id,
    cartNumber: cart.key || undefined,
    customerId: cart.customerId || undefined,
    customerName: cart.customerEmail || cart.customerId || "Guest / unassigned",
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
      shippingMethodId: cart.shippingInfo?.shippingMethodId ?? undefined,
      shippingMethodName: cart.shippingInfo?.shippingMethodName || "",
      price: moneyToNumber(cart.shippingInfo?.price),
      taxRate: "",
      carrier: ""
    },
    discountCodes: cart.discountCodes ?? [],
    appliedDiscounts: [],
    ineffectiveDiscounts: [],
    netTotal: lineItemsTotal,
    taxTotal: 0,
    shippingTotal: moneyToNumber(cart.shippingInfo?.price),
    discountTotal: 0,
    grandTotal
  };
}

export function useCartStore() {
  const queryClient = useQueryClient();

  const {
    data: carts = [],
    isLoading: loading,
    error: queryError,
    refetch
  } = useQuery<Cart[]>({
    queryKey: ["carts"],
    queryFn: async () => {
      const response = await fetch("/api/carts?limit=100");
      const payload = (await response.json().catch(() => ({}))) as ApiCartListResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Failed to load carts (${response.status})`);
      }

      const mapped = (payload.results ?? []).map(mapApiCart);
      mapped.forEach((c) => {
        queryClient.setQueryData(["cart", c.id], c);
      });
      return mapped;
    },
    staleTime: 60_000,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load carts.") : null;

  const reloadCarts = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const updateCart = useCallback(
    async (cartId: string, actions: Array<Record<string, unknown>>) => {
      const response = await fetch(`/api/carts/${encodeURIComponent(cartId)}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions })
      });
      const payload = (await response.json().catch(() => ({}))) as ApiCart & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Unable to update cart.");
      const updated = mapApiCart(payload);
      queryClient.setQueryData(["cart", cartId], updated);
      queryClient.setQueryData<Cart[]>(["carts"], (prev) =>
        prev ? prev.map((c) => (c.id === cartId ? updated : c)) : [updated]
      );
      void queryClient.invalidateQueries({ queryKey: ["carts"] });
      return updated;
    },
    [queryClient]
  );

  const getCartById = useCallback(
    (id: string) =>
      carts.find((c) => c.id === id || c.cartNumber === id) ??
      queryClient.getQueryData<Cart>(["cart", id]),
    [carts, queryClient]
  );

  const updateLineItemQuantity = useCallback(
    async (cartId: string, lineItemId: string, newQty: number) => {
      await updateCart(cartId, [
        { changeLineItemQuantity: { lineItemId, quantity: newQty } }
      ]);
    },
    [updateCart]
  );

  const addLineItemToCart = useCallback(
    async (
      cartId: string,
      newItem: Omit<CartLineItem, "id" | "subtotal" | "tax" | "totalGross">
    ) => {
      await updateCart(cartId, [
        { addLineItem: { sku: newItem.sku, quantity: newItem.quantity } }
      ]);
    },
    [updateCart]
  );

  const applyDiscountCode = useCallback(
    async (cartId: string, code: string) => {
      await updateCart(cartId, [{ addDiscountCode: { code: code.trim() } }]);
    },
    [updateCart]
  );

  const updateShippingMethod = useCallback(
    async (cartId: string, methodId: string, _methodName: string) => {
      await updateCart(cartId, [
        {
          setShippingMethod: {
            shippingMethod: { typeId: "shipping-method", id: methodId }
          }
        }
      ]);
    },
    [updateCart]
  );

  const updateShippingAddress = useCallback(
    async (cartId: string, newAddress: CartAddress) => {
      await updateCart(cartId, [{ setShippingAddress: { address: newAddress } }]);
    },
    [updateCart]
  );

  const updateBillingAddress = useCallback(
    async (cartId: string, newAddress: CartAddress) => {
      await updateCart(cartId, [{ setBillingAddress: { address: newAddress } }]);
    },
    [updateCart]
  );

  const placeOrderFromCart = useCallback(
    async (cartId: string): Promise<string> => {
      const response = await fetch(`/api/carts/${encodeURIComponent(cartId)}/order`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !payload.id)
        throw new Error(payload.error || "Unable to place order.");
      await queryClient.invalidateQueries({ queryKey: ["carts"] });
      await queryClient.invalidateQueries({ queryKey: ["cart", cartId] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      return payload.id;
    },
    [queryClient]
  );

  return {
    carts,
    loading,
    error,
    reloadCarts,
    updateCart,
    getCartById,
    updateLineItemQuantity,
    addLineItemToCart,
    applyDiscountCode,
    updateShippingMethod,
    updateShippingAddress,
    updateBillingAddress,
    placeOrderFromCart
  };
}

export function useCartDetail(id: string) {
  const {
    data: cart,
    isLoading: loading,
    error: queryError,
    refetch
  } = useQuery<Cart>({
    queryKey: ["cart", id],
    queryFn: async () => {
      const response = await fetch(`/api/carts/${encodeURIComponent(id)}`);
      const payload = (await response.json().catch(() => ({}))) as ApiCart & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load cart (${response.status})`);
      }
      return mapApiCart(payload);
    },
    enabled: !!id,
    staleTime: 60_000,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load cart.") : null;

  const {
    updateCart,
    updateLineItemQuantity,
    addLineItemToCart,
    applyDiscountCode,
    updateShippingMethod,
    updateShippingAddress,
    updateBillingAddress,
    placeOrderFromCart
  } = useCartStore();

  const reloadCart = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    cart,
    loading,
    error,
    reloadCart,
    updateCart,
    updateLineItemQuantity,
    addLineItemToCart,
    applyDiscountCode,
    updateShippingMethod,
    updateShippingAddress,
    updateBillingAddress,
    placeOrderFromCart
  };
}
