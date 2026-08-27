export type LocalizedString = Array<{ value: string }>;

export type CtMoney = {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
};

export type CtProduct = {
  id: string;
  key?: string;
  masterData?: {
    current?: {
      descriptionAllLocales?: LocalizedString;
      masterVariant?: {
        images?: Array<{ url: string }>;
        prices?: Array<{ value: CtMoney }>;
        sku?: string;
      };
      nameAllLocales?: LocalizedString;
      slugAllLocales?: LocalizedString;
    };
  };
};

export type CtLineItem = {
  id: string;
  nameAllLocales?: LocalizedString;
  productId?: string;
  quantity: number;
  totalPrice: CtMoney;
  variant?: {
    sku?: string;
  };
};

export type CtCart = {
  billingAddress?: CtAddress | null;
  cartState?: string;
  createdAt?: string;
  customerId?: string;
  customerEmail?: string;
  id: string;
  key?: string;
  lastModifiedAt?: string;
  lineItems?: CtLineItem[];
  shippingAddress?: CtAddress | null;
  totalPrice: CtMoney;
  version: number;
};

export type CtAddress = {
  streetName?: string;
  streetNumber?: string;
  apartment?: string;
  building?: string;
  pOBox?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2 country code returned by CT as a plain string. */
  country?: string;
  phone?: string;
  mobile?: string;
  additionalStreetInfo?: string;
  additionalAddressInfo?: string;
};

export type CtReturnItem = {
  id: string;
  type?: string;
  quantity: number;
  lineItemId?: string;  // only present on LineItemReturnItem (inline fragment)
  shipmentState: string;
  paymentState: string;
  comment?: string | null;
};

export type CtReturnInfo = {
  returnTrackingId?: string | null;
  returnDate?: string | null;
  items: CtReturnItem[];
};

export type CtOrder = {
  createdAt?: string;
  customerId?: string;
  customerEmail?: string;
  id: string;
  lastModifiedAt?: string;
  lineItems?: CtLineItem[];
  orderNumber?: string;
  orderState?: string;
  paymentState?: string;
  shipmentState?: string;
  totalPrice: CtMoney;
  shippingAddress?: CtAddress | null;
  billingAddress?: CtAddress | null;
  returnInfo?: CtReturnInfo[] | null;
};

export type CtCustomer = {
  companyName?: string;
  customerNumber?: string;
  customerGroup?: {
    id: string;
    key?: string;
    name?: string;
  };
  createdAt?: string;
  email: string;
  externalId?: string;
  firstName?: string;
  id: string;
  key?: string;
  lastModifiedAt?: string;
  lastName?: string;
  version?: number;
};
