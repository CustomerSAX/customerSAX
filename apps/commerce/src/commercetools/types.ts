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
};

export type CtOrder = {
  createdAt?: string;
  customerId?: string;
  id: string;
  lineItems?: CtLineItem[];
  orderNumber?: string;
  orderState?: string;
  totalPrice: CtMoney;
};

export type CtCustomer = {
  customerNumber?: string;
  email: string;
  firstName?: string;
  id: string;
  lastName?: string;
};

