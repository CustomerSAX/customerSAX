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
  apartment?: string | null;
  building?: string | null;
  additionalStreetInfo?: string | null;
  additionalAddressInfo?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
};

export type RawCustomField = { name: string; value: unknown };

export type Customer = {
  id: string;
  version: number;
  key?: string | null;
  customerNumber?: string | null;
  email: string;
  title?: string | null;
  salutation?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  vatId?: string | null;
  dateOfBirth?: string | null;
  locale?: string | null;
  authenticationMode?: string | null;
  isEmailVerified: boolean;
  createdAt: string;
  lastModifiedAt: string;
  customerGroup?: { id: string; name?: string | null } | null;
  addresses?: Address[];
  defaultShippingAddressId?: string | null;
  defaultBillingAddressId?: string | null;
  shippingAddressIds?: string[];
  billingAddressIds?: string[];
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
  discountCodes?: DiscountCodeInfo[];
  custom?: { customFieldsRaw?: RawCustomField[] | null } | null;
};

export type Parcel = {
  id: string;
  createdAt?: string | null;
  items?: Array<{ id: string; quantity: number }>;
  measurements?: {
    heightInMillimeter?: number | null;
    lengthInMillimeter?: number | null;
    widthInMillimeter?: number | null;
    weightInGram?: number | null;
  } | null;
  trackingData?: {
    trackingId?: string | null;
    carrier?: string | null;
    provider?: string | null;
    providerTransaction?: string | null;
    isReturn?: boolean | null;
  } | null;
};

export type Delivery = {
  id: string;
  createdAt: string;
  items?: Array<{ id: string; quantity: number }>;
  address?: Address | null;
  parcels: Parcel[];
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
  interfaceId?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
  amountPlanned: Money;
  paymentMethodInfo?: {
    paymentInterface?: string | null;
    method?: string | null;
    name?: string | Record<string, string> | null;
  } | null;
  paymentStatus?: {
    interfaceCode?: string | null;
    interfaceText?: string | null;
  } | null;
  transactions: Array<{
    id: string;
    timestamp?: string | null;
    type: string;
    state: string;
    amount: Money;
    interactionId?: string | null;
  }>;
  isDerived?: boolean;
};

export type DiscountCode = {
  id: string;
  code: string;
  name?: Record<string, string>;
};

export type DiscountCodeInfo = {
  state: string;
  discountCode: {
    id: string;
    code?: string;
    nameAllLocales?: Array<{ locale: string; value: string }>;
    obj?: DiscountCode;
  };
};

export type ShoppingList = {
  id: string;
  version: number;
  key?: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  lineItems?: Array<{
    id: string;
    productId: string;
    variantId: number;
    quantity: number;
    addedAt?: string;
    name?: Record<string, string>;
    variant?: {
      sku?: string;
      key?: string;
      images?: Array<{ url: string; label?: string }>;
      prices?: Array<{ value: Money }>;
    };
  }>;
  textLineItems?: Array<{
    id: string;
    name: Record<string, string>;
    quantity: number;
  }>;
  createdAt: string;
  lastModifiedAt: string;
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
  taxedShippingPrice?: {
    totalNet: Money;
    totalGross: Money;
  } | null;
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
    shippingMethod?: { id: string; name?: string | null } | null;
    shippingMethodState?: string | null;
    price?: Money | null;
    taxRate?: {
      name?: string | null;
      amount?: number | null;
      includedInPrice?: boolean | null;
      country?: string | null;
      state?: string | null;
    } | null;
    deliveries: Delivery[];
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

export type LocalizedValue = { locale: string; value: string };

export type ProductVariant = {
  id: number;
  sku?: string | null;
  key?: string | null;
  images?: Array<{ url: string; label?: string | null }>;
  prices?: Array<{ value: Money }>;
  availability?: {
    noChannel?: {
      isOnStock?: boolean | null;
      availableQuantity?: number | null;
    } | null;
  } | null;
  attributesRaw?: RawCustomField[];
};

export type Product = {
  id: string;
  version: number;
  key?: string | null;
  createdAt: string;
  lastModifiedAt: string;
  priceMode?: string | null;
  productType: { id: string; name: string };
  taxCategory?: { id: string; name: string } | null;
  masterData: {
    published: boolean;
    current: {
      nameAllLocales: LocalizedValue[];
      descriptionAllLocales?: LocalizedValue[];
      categories?: Array<{ id: string; name?: string | null }>;
      masterVariant?: ProductVariant;
      allVariants: ProductVariant[];
    };
  };
};
