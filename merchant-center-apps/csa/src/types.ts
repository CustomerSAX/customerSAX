export type Money = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

export type Address = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type RawCustomField = { name: string; value: unknown };

export type Customer = {
  id: string;
  version: number;
  key?: string | null;
  customerNumber?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  dateOfBirth?: string | null;
  locale?: string | null;
  isEmailVerified: boolean;
  createdAt: string;
  lastModifiedAt: string;
  customerGroup?: { id: string; name?: string | null } | null;
  addresses?: Address[];
  stores?: Array<{ key: string }>;
  custom?: {
    type?: { key: string; name?: string | null } | null;
    customFieldsRaw?: RawCustomField[] | null;
  } | null;
};

export type CustomerGroup = {
  id: string;
  key?: string | null;
  name?: string | null;
};

export type Cart = {
  id: string;
  version: number;
  key?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  cartState: string;
  createdAt: string;
  lastModifiedAt: string;
  totalLineItemQuantity?: number | null;
  totalPrice: Money;
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  lineItems?: Array<{
    id: string;
    productId?: string | null;
    name?: string | null;
    nameAllLocales?: Array<{ locale: string; value: string }>;
    quantity: number;
    totalPrice: Money;
    variant?: { sku?: string | null } | null;
  }>;
  custom?: { customFieldsRaw?: RawCustomField[] | null } | null;
};

export type Parcel = {
  id: string;
  trackingData?: {
    trackingId?: string | null;
    carrier?: string | null;
    provider?: string | null;
    isReturn?: boolean | null;
  } | null;
};

export type ReturnInfo = {
  returnTrackingId?: string | null;
  returnDate?: string | null;
  items: Array<{
    id: string;
    quantity: number;
    shipmentState: string;
    paymentState: string;
    comment?: string | null;
  }>;
};

export type Payment = {
  id: string;
  amountPlanned: Money;
  paymentMethodInfo?: { method?: string | null; name?: string | null } | null;
  transactions: Array<{
    id: string;
    timestamp?: string | null;
    type: string;
    state: string;
    amount: Money;
  }>;
};

export type Order = {
  id: string;
  version: number;
  orderNumber?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  orderState: string;
  paymentState?: string | null;
  shipmentState?: string | null;
  createdAt: string;
  lastModifiedAt: string;
  totalPrice: Money;
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  lineItems?: Array<{
    id: string;
    productId?: string | null;
    name?: string | null;
    nameAllLocales?: Array<{ locale: string; value: string }>;
    quantity: number;
    totalPrice: Money;
    variant?: { sku?: string | null } | null;
    custom?: { customFieldsRaw?: RawCustomField[] | null } | null;
  }>;
  shippingInfo?: {
    shippingMethodName?: string | null;
    deliveries: Array<{ id: string; createdAt: string; parcels: Parcel[] }>;
  } | null;
  returnInfo?: ReturnInfo[];
  paymentInfo?: { payments: Payment[] } | null;
  custom?: {
    type?: { key: string; name?: string | null } | null;
    customFieldsRaw?: RawCustomField[] | null;
  } | null;
};

export type TypeDefinition = {
  id: string;
  key: string;
  name?: string | null;
  resourceTypeIds: string[];
  createdAt: string;
  lastModifiedAt: string;
  fieldDefinitions: Array<{
    name: string;
    label?: string | null;
    required: boolean;
    inputHint: string;
    type: { name: string };
  }>;
};

export type QueryPage<T> = {
  total: number;
  count: number;
  offset: number;
  results: T[];
};
