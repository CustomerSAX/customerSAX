export type OrderMoney = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

export type OrderAddress = {
  streetName?: string;
  streetNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type OrderLineItem = {
  id: string;
  name: string;
  quantity: number;
  totalPrice?: OrderMoney;
};

export type SalesOrder = {
  id: string;
  orderNumber?: string;
  customerId?: string;
  customerEmail?: string;
  orderState: string;
  shipmentState?: string;
  paymentState?: string;
  createdAt: string;
  totalPrice?: OrderMoney;
  lineItems: OrderLineItem[];
  shippingAddress?: OrderAddress;
  billingAddress?: OrderAddress;
};

export type CustomerOrdersData = {
  orderPage: {
    total: number;
    count: number;
    offset: number;
    results: SalesOrder[];
  };
};

export type CustomerOrdersVariables = {
  customerId?: string;
  customerEmail?: string;
  limit?: number;
  offset?: number;
};
