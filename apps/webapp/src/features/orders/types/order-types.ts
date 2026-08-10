export type OrderState = "Open" | "Confirmed" | "Complete" | "Cancelled";
export type ShipmentState = "Shipped" | "Ready" | "Pending" | "Delayed" | "Partial" | "Backorder";
export type PaymentState = "Paid" | "Pending" | "BalanceDue" | "Failed" | "CreditOwed";

export interface OrderLineItem {
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

export interface OrderAddress {
  streetNumber?: string;
  streetName: string;
  building?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderDeliveryParcel {
  id: string;
  trackingId: string;
  carrier: string;
  itemsCount: number;
  shippedAt: string;
}

export interface OrderShippingInfo {
  shippingMethodId?: string;
  shippingMethodName: string;
  price: number;
  taxRate: string;
  carrier: string;
  parcels: OrderDeliveryParcel[];
}

export interface OrderReturnItem {
  id: string;
  lineItemId: string;
  name: string;
  sku: string;
  key?: string;
  imageUrl?: string;
  quantity: number;
  shipmentState: "Returned" | "Advised";
  paymentState: "Initial" | "Refunded" | "NotRefunded" | "NonRefundable";
  comment?: string;
  createdAt: string;
}

export interface OrderReturnInfo {
  returnTrackingId: string;
  returnDate: string;
  items: OrderReturnItem[];
}

export interface OrderPaymentTransaction {
  id: string;
  timestamp: string;
  type: "Charge" | "Refund" | "Authorization";
  state: "Success" | "Pending" | "Failure";
  amount: number;
  interactionId: string;
}

export interface OrderPayment {
  id: string;
  interfaceId: string;
  method: string;
  psp: string;
  amountPlanned: number;
  pspPaymentStatus: string;
  paymentLink?: string;
  createdAt: string;
  lastModifiedAt?: string;
  transactions: OrderPaymentTransaction[];
}

export interface OrderComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface CustomFieldEntry {
  name: string;
  value: unknown;
}

export interface AppliedDiscountRow {
  code: string;
  name?: string;
  value?: string;
  savings: string;
}

export interface IneffectiveDiscountRow {
  code: string;
  message: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  companyName?: string;
  store: string;
  createdAt: string;
  lastModifiedAt: string;
  orderState: OrderState;
  shipmentState: ShipmentState;
  paymentState: PaymentState;
  lineItems: OrderLineItem[];
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  shippingInfo: OrderShippingInfo;
  returnInfo: OrderReturnInfo[];
  payments: OrderPayment[];
  comments: OrderComment[];
  giftMessage?: string;
  discountCodes: string[];
  appliedDiscounts?: AppliedDiscountRow[];
  ineffectiveDiscounts?: IneffectiveDiscountRow[];
  customFields?: CustomFieldEntry[];
  netTotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
}
