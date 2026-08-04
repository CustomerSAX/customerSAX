import type { CommerceProvider } from "../domain/types.js";

const money = {
  centAmount: 1299,
  currencyCode: "USD",
  fractionDigits: 2
};

const sampleProduct = {
  id: "sample-product",
  key: "sample-product",
  name: "Sample Product",
  price: money,
  sku: "CSA-SAMPLE",
  slug: "sample-product"
};

export const sampleCommerceProvider: CommerceProvider = {
  getCart: async () => ({
    currencyCode: "USD",
    id: "sample-cart",
    lineItems: [
      {
        id: "sample-line-item",
        name: "Sample Product",
        quantity: 1,
        sku: "CSA-SAMPLE",
        totalPrice: money
      }
    ],
    totalPrice: money
  }),
  getCustomer: async () => ({
    email: "customer@example.com",
    firstName: "Sample",
    id: "sample-customer",
    lastName: "Customer"
  }),
  getOrder: async () => ({
    createdAt: new Date(0).toISOString(),
    id: "sample-order",
    lineItems: [],
    orderNumber: "CSA-0001",
    state: "Open",
    totalPrice: money
  }),
  getProduct: async () => sampleProduct,
  listCarts: async () => [],
  listCustomers: async () => [],
  listOrders: async () => [],
  listProducts: async () => [sampleProduct],
  name: "sample"
};
