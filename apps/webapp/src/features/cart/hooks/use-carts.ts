"use client";

import { useState, useCallback } from "react";
import type {
  Cart,
  CartState,
  CartLineItem,
  CartAddress,
  CartAppliedDiscountRow,
  CartIneffectiveDiscountRow,
} from "../types/cart-types";


export const MOCK_AVAILABLE_DISCOUNTS = [
  { code: "SUMMER15", name: "Summer Sale 15% Off", value: "15% off cart subtotal" },
  { code: "FREESHIP", name: "Free Standard Shipping", value: "$25.00 shipping credit" },
  { code: "WINTER10", name: "Winter Promo $10", value: "$10.00 direct credit" },
  { code: "VIP20", name: "VIP Executive Member 20%", value: "20% off whole order" },
  { code: "EXPIRED99", name: "Legacy Discount Code", value: "Expired" },
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

export const INITIAL_CARTS: Cart[] = [
  {
    id: "cart-101",
    cartNumber: "CRT-9014",
    orderNumber: "ORD-DRAFT-9014",
    customerId: "cust-101",
    customerName: "Mia Johnson",
    customerEmail: "mia.johnson@example.com",
    companyName: "Northwind Retail",
    store: "US Flagship Store",
    country: "US",
    currencyCode: "USD",
    createdAt: "2026-08-07T11:20:00Z",
    lastModifiedAt: "2026-08-07T14:10:00Z",
    cartState: "Active",
    lineItems: [
      {
        id: "cli-101",
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
        id: "cli-102",
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
      streetNumber: "742",
      streetName: "Evergreen Terrace",
      apartment: "Apt 4B",
      building: "Building C",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      country: "US",
      phone: "+1 555-0192",
    },
    billingAddress: {
      streetNumber: "742",
      streetName: "Evergreen Terrace",
      apartment: "Apt 4B",
      building: "Building C",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      country: "US",
      phone: "+1 555-0192",
    },
    shippingInfo: {
      shippingMethodId: "sm-fedex-express",
      shippingMethodName: "FedEx Express 2-Day Delivery",
      price: 25.0,
      taxRate: "8.0%",
      carrier: "FedEx",
    },
    discountCodes: ["SUMMER15"],
    appliedDiscounts: [
      { code: "SUMMER15", name: "Summer Sale 15% Off", value: "15% off subtotal", savings: "$57.00" },
    ],
    ineffectiveDiscounts: [],
    netTotal: 379.98,
    taxTotal: 30.4,
    shippingTotal: 25.0,
    discountTotal: 57.0,
    grandTotal: 378.38,
  },
  {
    id: "cart-102",
    cartNumber: "CRT-8802",
    orderNumber: "ORD-DRAFT-8802",
    customerId: "cust-102",
    customerName: "Alex Chen",
    customerEmail: "alex.chen@apexdigital.com",
    companyName: "Apex Digital Solutions",
    store: "US Flagship Store",
    country: "US",
    currencyCode: "USD",
    createdAt: "2026-08-06T15:45:00Z",
    lastModifiedAt: "2026-08-07T09:30:00Z",
    cartState: "Active",
    lineItems: [
      {
        id: "cli-201",
        productId: "prod-102",
        key: "ultrawide-34",
        name: "Ultra-Wide 34\" Curved Monitor 144Hz",
        sku: "MON-UW34-09",
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=150&auto=format&fit=crop",
        unitPrice: 599.99,
        quantity: 2,
        subtotal: 1199.98,
        tax: 96.0,
        totalGross: 1295.98,
      },
    ],
    shippingAddress: {
      streetNumber: "100",
      streetName: "Market Street, Suite 400",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      phone: "+1 415-555-0188",
    },
    billingAddress: {
      streetNumber: "100",
      streetName: "Market Street, Suite 400",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      phone: "+1 415-555-0188",
    },
    shippingInfo: {
      shippingMethodId: "sm-ups-ground",
      shippingMethodName: "UPS Standard Ground",
      price: 15.0,
      taxRate: "8.0%",
      carrier: "UPS",
    },
    discountCodes: [],
    appliedDiscounts: [],
    ineffectiveDiscounts: [],
    netTotal: 1199.98,
    taxTotal: 96.0,
    shippingTotal: 15.0,
    discountTotal: 0,
    grandTotal: 1310.98,
  },
  {
    id: "cart-103",
    cartNumber: "CRT-7741",
    orderNumber: "ORD-DRAFT-7741",
    customerId: undefined,
    customerName: "Guest Customer",
    customerEmail: "guest.buyer@example.org",
    companyName: undefined,
    store: "US Flagship Store",
    country: "US",
    currencyCode: "USD",
    createdAt: "2026-08-07T08:15:00Z",
    lastModifiedAt: "2026-08-07T08:15:00Z",
    cartState: "Active",
    lineItems: [
      {
        id: "cli-301",
        productId: "prod-103",
        key: "anc-headphones",
        name: "Wireless Noise-Canceling Headphones",
        sku: "AUD-ANC-900",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&auto=format&fit=crop",
        unitPrice: 199.99,
        quantity: 1,
        subtotal: 199.99,
        tax: 16.0,
        totalGross: 215.99,
      },
    ],
    shippingInfo: {
      shippingMethodId: "sm-usps-priority",
      shippingMethodName: "USPS Priority Mail",
      price: 10.0,
      taxRate: "8.0%",
      carrier: "USPS",
    },
    discountCodes: [],
    appliedDiscounts: [],
    ineffectiveDiscounts: [],
    netTotal: 199.99,
    taxTotal: 16.0,
    shippingTotal: 10.0,
    discountTotal: 0,
    grandTotal: 225.99,
  },
];

export function useCartStore() {
  const [carts, setCarts] = useState<Cart[]>(INITIAL_CARTS);

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

        const match = MOCK_AVAILABLE_DISCOUNTS.find((d) => d.code === uppercaseCode);
        const updatedCodes = [...c.discountCodes, uppercaseCode];

        if (match && match.code !== "EXPIRED99") {
          const newAppliedRow: CartAppliedDiscountRow = {
            code: match.code,
            name: match.name,
            value: match.value,
            savings: "$15.00",
          };
          const appliedDiscounts = [...(c.appliedDiscounts || []), newAppliedRow];
          const discountTotal = c.discountTotal + 15.0;
          const grandTotal = Math.max(0, c.netTotal + c.taxTotal + c.shippingTotal - discountTotal);

          return {
            ...c,
            discountCodes: updatedCodes,
            appliedDiscounts,
            discountTotal,
            grandTotal,
            lastModifiedAt: new Date().toISOString(),
          };
        } else {
          const newIneffectiveRow: CartIneffectiveDiscountRow = {
            code: uppercaseCode,
            message: match ? "Discount code has expired or cart threshold requirements were not met." : "Invalid or unrecognized promotional code.",
          };
          const ineffectiveDiscounts = [...(c.ineffectiveDiscounts || []), newIneffectiveRow];

          return {
            ...c,
            discountCodes: updatedCodes,
            ineffectiveDiscounts,
            lastModifiedAt: new Date().toISOString(),
          };
        }
      })
    );
  }, []);

  const updateShippingMethod = useCallback((cartId: string, methodId: string) => {
    const selectedMethod = MOCK_SHIPPING_METHODS.find((m) => m.id === methodId) || MOCK_SHIPPING_METHODS[0];

    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== cartId && c.cartNumber !== cartId) return c;

        const shippingInfo = {
          ...c.shippingInfo,
          shippingMethodId: selectedMethod.id,
          shippingMethodName: selectedMethod.name,
          price: selectedMethod.price,
          carrier: selectedMethod.carrier,
        };
        const grandTotal = Math.max(0, c.netTotal + c.taxTotal + selectedMethod.price - c.discountTotal);

        return {
          ...c,
          shippingInfo,
          shippingTotal: selectedMethod.price,
          grandTotal,
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

  const sendPaymentReminder = useCallback((cartId: string, _altEmail: string): boolean => {
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
