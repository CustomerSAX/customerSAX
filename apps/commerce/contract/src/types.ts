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

export type OrderReturnItem = {
  id: string;
  type?: string | null;
  quantity: number;
  lineItemId?: string | null;
  shipmentState: string;
  paymentState: string;
  comment?: string | null;
};

export type OrderReturnInfo = {
  returnTrackingId?: string | null;
  returnDate?: string | null;
  items: OrderReturnItem[];
};

export type OrderAddress = {
  streetName?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type Order = {
  createdAt?: string;
  customerId?: string;
  customerEmail?: string;
  id: string;
  lineItems: CommerceLineItem[];
  lastModifiedAt?: string;
  orderNumber?: string;
  orderState?: string;
  paymentState?: string;
  shipmentState?: string;
  state?: string;
  totalPrice?: Money;
  shippingAddress?: OrderAddress | null;
  billingAddress?: OrderAddress | null;
  returnInfo?: OrderReturnInfo[] | null;
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

/**
 * The platform-neutral port every commerce adapter implements (see
 * `createCommercetoolsProvider`). Callers program against this interface only,
 * so the backing platform can be swapped with zero caller change. `name`
 * identifies which platform is wired up at runtime.
 */
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
