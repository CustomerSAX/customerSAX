"use client";

import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { CART_CUSTOMERS_QUERY, CARTS_QUERY } from "../api/queries";

export type CartMoney = { centAmount: number; currencyCode: string; fractionDigits?: number | null };
export type CartLineItem = { id: string; productId?: string | null; sku?: string | null; name: string; quantity: number; totalPrice: CartMoney };
export type CommerceCart = { id: string; version: number; key?: string | null; customerId?: string | null; customerName?: string | null; currencyCode: string; totalPrice: CartMoney; lineItems: CartLineItem[] };

type CartCustomer = { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; email?: string | null };

export function useCartStore() {
  const query = useQuery(CARTS_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: { limit: 100, offset: 0 }
  });
  const customersQuery = useQuery(CART_CUSTOMERS_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: { limit: 500, offset: 0 }
  });
  const carts = useMemo<CommerceCart[]>(() => {
    const customers = (customersQuery.data?.customerPage.results ?? []) as CartCustomer[];
    const customerNames = new Map(customers.map((customer) => {
      const personalName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
      return [customer.id, personalName || customer.companyName || customer.email || "Unknown customer"];
    }));
    return (query.data?.cartPage.results ?? []).map((cart: CommerceCart) => ({
      ...cart,
      customerName: cart.customerId ? customerNames.get(cart.customerId) ?? "Unknown customer" : null,
    }));
  }, [customersQuery.data, query.data]);
  const refetch = async () => {
    await Promise.all([query.refetch(), customersQuery.refetch()]);
  };
  return { carts, total: query.data?.cartPage.total ?? carts.length, loading: query.loading || customersQuery.loading, error: query.error ?? customersQuery.error, refetch };
}

export function formatCartMoney(money: CartMoney) {
  const digits = money.fractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: money.currencyCode }).format(money.centAmount / 10 ** digits);
}
