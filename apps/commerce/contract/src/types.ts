export type Money = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

export type Product = {
  description?: string;
  id: string;
  imageUrl?: string;
  key?: string;
  name: string;
  price?: Money;
  sku?: string;
  slug?: string;
};

export type Page<TItem> = {
  count: number;
  offset: number;
  results: TItem[];
  total: number;
};

export type CommerceLineItem = {
  id: string;
  name: string;
  productId?: string;
  quantity: number;
  sku?: string;
  totalPrice: Money;
};

export type Cart = {
  currencyCode: string;
  customerId?: string;
  id: string;
  key?: string;
  lineItems: CommerceLineItem[];
  totalPrice: Money;
  version: number;
};

export type Order = {
  createdAt?: string;
  customerId?: string;
  id: string;
  lineItems: CommerceLineItem[];
  orderNumber?: string;
  state?: string;
  totalPrice: Money;
};

export type Customer = {
  customerNumber?: string;
  externalId?: string;
  key?: string;
  email?: string;
  firstName?: string;
  id: string;
  lastName?: string;
  companyName?: string;
  customerGroup?: {
    id: string;
    key?: string;
    name?: string;
  };
  version?: number;
  createdAt?: string;
  lastModifiedAt?: string;
};

export type CommerceProvider = {
  getCart(args: { id?: string; key?: string }): Promise<Cart | null>;
  getCustomer(args: { email?: string; id?: string }): Promise<Customer | null>;
  getOrder(args: { id?: string; orderNumber?: string }): Promise<Order | null>;
  getProduct(args: { id?: string; key?: string }): Promise<Product | null>;
  listCarts(args: { limit?: number; offset?: number }): Promise<Page<Cart>>;
  listCustomers(args: { limit?: number; offset?: number }): Promise<Page<Customer>>;
  listOrders(args: { limit?: number; offset?: number }): Promise<Page<Order>>;
  listProducts(args: { limit?: number; offset?: number }): Promise<Page<Product>>;
  name: string;
};
