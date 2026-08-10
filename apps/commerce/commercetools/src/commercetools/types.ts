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
  customerId?: string;
  id: string;
  key?: string;
  lineItems?: CtLineItem[];
  totalPrice: CtMoney;
  version: number;
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
