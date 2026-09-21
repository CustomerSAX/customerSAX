export type SubscriptionStatus = "Draft" | "Active" | "Paused" | "On Hold" | "Cancelled" | "Expired";

export type SubscriptionLineItem = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type SubscriptionHistoryEntry = {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
  note?: string | null;
};

export type Subscription = {
  id: string;
  subscriptionNumber: string;
  projectKey: string;
  ownerType: string;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  createdBy: string;
  businessAccountName?: string | null;
  status: SubscriptionStatus;
  frequency: string;
  startDate: string;
  scheduleTime?: string | null;
  nextDeliveryDate: string;
  endDate?: string | null;
  shippingAddress: string;
  paymentMethod: string;
  currencyCode: string;
  discountLabel?: string | null;
  priceOverride?: string | null;
  cancellationReason?: string | null;
  lastOrderNumber?: string | null;
  linkedOrderNumbers: string[];
  lineItems: SubscriptionLineItem[];
  history: SubscriptionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionDraft = Omit<
  Subscription,
  "id" | "subscriptionNumber" | "projectKey" | "createdBy" | "history" | "createdAt" | "updatedAt"
>;

export type SubscriptionUpdate = Partial<SubscriptionDraft>;

export type SubscriptionListArgs = {
  customerId?: string | null;
  customerEmail?: string | null;
  status?: string | null;
  limit?: number | null;
  offset?: number | null;
  projectKey?: string | null;
};
