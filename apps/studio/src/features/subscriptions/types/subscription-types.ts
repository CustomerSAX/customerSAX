export type SubscriptionStatus =
  | "Draft"
  | "Active"
  | "Paused"
  | "On Hold"
  | "Cancelled"
  | "Expired";

export type SubscriptionFrequency =
  "Weekly" | "Every 2 weeks" | "Monthly" | "Quarterly" | "Yearly";

export type SubscriptionOwnerType = "B2C" | "B2B";

export interface SubscriptionLineItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface SubscriptionHistoryEntry {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
  note?: string;
}

export interface CustomerSubscription {
  id: string;
  subscriptionNumber: string;
  ownerType: SubscriptionOwnerType;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  createdBy: string;
  businessAccountName?: string;
  status: SubscriptionStatus;
  frequency: SubscriptionFrequency;
  startDate: string;
  nextDeliveryDate: string;
  endDate?: string;
  shippingAddress: string;
  paymentMethod: string;
  currencyCode: string;
  discountLabel?: string;
  priceOverride?: string;
  cancellationReason?: string;
  lastOrderNumber?: string;
  linkedOrderNumbers: string[];
  lineItems: SubscriptionLineItem[];
  history: SubscriptionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionDraft = Omit<
  CustomerSubscription,
  | "id"
  | "subscriptionNumber"
  | "createdBy"
  | "history"
  | "createdAt"
  | "updatedAt"
  | "linkedOrderNumbers"
> & {
  linkedOrderNumbers?: string[];
};
