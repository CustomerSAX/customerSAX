import type {
  Cart,
  CommerceProvider,
  Customer,
  Order,
  Product
} from "@csa/commerce-contract";

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export function createRemoteCommerceProvider(name: string, url: string): CommerceProvider {
  return {
    getCart: async (args) => {
      const data = await graphql<{ cart: Cart | null }>(
        url,
        `query Cart($id: ID, $key: String) {
          cart(id: $id, key: $key) {
            id key customerId currencyCode
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems {
              id productId sku name quantity
              totalPrice { centAmount currencyCode fractionDigits }
            }
          }
        }`,
        args
      );

      return data.cart;
    },
    getCustomer: async (args) => {
      const data = await graphql<{ customer: Customer | null }>(
        url,
        `query Customer($id: ID, $email: String) {
          customer(id: $id, email: $email) {
            id customerNumber email firstName lastName
          }
        }`,
        args
      );

      return data.customer;
    },
    getOrder: async (args) => {
      const data = await graphql<{ order: Order | null }>(
        url,
        `query Order($id: ID, $orderNumber: String) {
          order(id: $id, orderNumber: $orderNumber) {
            id orderNumber customerId state createdAt
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems {
              id productId sku name quantity
              totalPrice { centAmount currencyCode fractionDigits }
            }
          }
        }`,
        args
      );

      return data.order;
    },
    getProduct: async (args) => {
      const data = await graphql<{ product: Product | null }>(
        url,
        `query Product($id: ID, $key: String) {
          product(id: $id, key: $key) {
            id key sku name description slug imageUrl
            price { centAmount currencyCode fractionDigits }
          }
        }`,
        args
      );

      return data.product;
    },
    listCarts: async (args) => {
      const data = await graphql<{ carts: Cart[] }>(
        url,
        `query Carts($limit: Int, $offset: Int) {
          carts(limit: $limit, offset: $offset) {
            id key customerId currencyCode
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems {
              id productId sku name quantity
              totalPrice { centAmount currencyCode fractionDigits }
            }
          }
        }`,
        args
      );

      return data.carts;
    },
    listCustomers: async (args) => {
      const data = await graphql<{ customers: Customer[] }>(
        url,
        `query Customers($limit: Int, $offset: Int) {
          customers(limit: $limit, offset: $offset) {
            id customerNumber email firstName lastName
          }
        }`,
        args
      );

      return data.customers;
    },
    listOrders: async (args) => {
      const data = await graphql<{ orders: Order[] }>(
        url,
        `query Orders($limit: Int, $offset: Int) {
          orders(limit: $limit, offset: $offset) {
            id orderNumber customerId state createdAt
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems {
              id productId sku name quantity
              totalPrice { centAmount currencyCode fractionDigits }
            }
          }
        }`,
        args
      );

      return data.orders;
    },
    listProducts: async (args) => {
      const data = await graphql<{ products: Product[] }>(
        url,
        `query Products($limit: Int, $offset: Int) {
          products(limit: $limit, offset: $offset) {
            id key sku name description slug imageUrl
            price { centAmount currencyCode fractionDigits }
          }
        }`,
        args
      );

      return data.products;
    },
    name
  };
}

async function graphql<TData>(
  url: string,
  query: string,
  variables: Record<string, unknown>
): Promise<TData> {
  const response = await fetch(url, {
    body: JSON.stringify({
      query,
      variables
    }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Commerce adapter returned ${response.status}`);
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("Commerce adapter returned no data");
  }

  return payload.data;
}

