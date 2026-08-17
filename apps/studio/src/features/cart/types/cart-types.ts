export type CartState = "Active" | "Merged" | "Frozen" | "Ordered";

export interface CartLineItem {
  id: string;
  productId: string;
  key?: string;
  name: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  tax: number;
  totalGross: number;
}

export interface CartAddress {
  id?: string;
  streetNumber?: string;
  streetName: string;
  apartment?: string;
  building?: string;
  pOBox?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  region?: string;
  additionalStreetInfo?: string;
  additionalAddressInfo?: string;
  phone?: string;
  mobile?: string;
}

export interface CartShippingInfo {
  shippingMethodId?: string;
  shippingMethodName: string;
  price: number;
  taxRate: string;
  carrier: string;
}

export interface CartAppliedDiscountRow {
  code: string;
  name?: string;
  value?: string;
  savings: string;
}

export interface CartIneffectiveDiscountRow {
  code: string;
  message: string;
}

export interface Cart {
  id: string;
  cartNumber?: string;
  orderNumber?: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  companyName?: string;
  store: string;
  country?: string;
  currencyCode?: string;
  createdAt: string;
  lastModifiedAt: string;
  cartState: CartState;
  lineItems: CartLineItem[];
  shippingAddress?: CartAddress;
  billingAddress?: CartAddress;
  shippingInfo: CartShippingInfo;
  discountCodes: string[];
  appliedDiscounts?: CartAppliedDiscountRow[];
  ineffectiveDiscounts?: CartIneffectiveDiscountRow[];
  netTotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
}
