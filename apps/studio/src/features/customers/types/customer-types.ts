export interface Customer {
  id: string;
  customerNumber?: string;
  externalId?: string;
  key?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email: string;
  phone?: string;
  customerGroup?: {
    id: string;
    name?: string;
    key?: string;
  };
  defaultShippingAddressId?: string;
  defaultBillingAddressId?: string;
  addresses?: CustomerAddress[];
  customFields?: Record<string, unknown>;
  segment?: string;
  version?: number;
  createdAt: string;
  lastModifiedAt?: string;
}

export interface CustomerGroup {
  id: string;
  key?: string;
  name: string;
}

export interface CustomerListFilters {
  searchOption: string; // 'allFields' | 'email' | 'firstName' | 'lastName' | 'companyName' | 'customerNumber' | 'externalId' | 'key' | 'id'
  searchText: string;
  customerGroupId: string;
  filterJoinMode: 'and' | 'or';
  groupAssignmentsId?: string;
  groupAssignmentsOperator?: 'is' | 'isNot';
  dateOfBirthFrom?: string;
  dateOfBirthTo?: string;
  dateCreatedFrom?: string;
  dateCreatedTo?: string;
  dateModifiedFrom?: string;
  dateModifiedTo?: string;
}

export interface CustomerAddress {
  id: string;
  streetName?: string;
  streetNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  email?: string;
  phone?: string;
  isShipping?: boolean;
  isBilling?: boolean;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface CustomerCart {
  id: string;
  cartState: string;
  orderNumber?: string;
  totalPrice: string;
  lineItemsCount: number;
  createdAt: string;
  currency?: string;
  country?: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  orderState: string;
  paymentState: string;
  totalPrice: string;
  itemsCount: number;
  createdAt: string;
}

export interface ReturnItem {
  id: string;
  quantity: number;
  shipmentState: string;
  paymentState: string;
  createdAt: string;
  lastModifiedAt?: string;
  comment?: string;
}

export interface CustomerReturn {
  id: string;
  orderNumber: string;
  returnTrackingId: string;
  returnDate: string;
  itemsCount: number;
  items: ReturnItem[];
}

export interface CustomerQuote {
  id: string;
  quoteKey?: string;
  quoteState: string;
  totalPrice: string;
  validUntil?: string;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  method: string;
  amount: string;
  status: string;
  createdAt: string;
}

export interface CustomerTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  createdAt: string;
}

export interface CustomerMessage {
  id: string;
  sender: 'customer' | 'agent' | 'system';
  senderName: string;
  content: string;
  createdAt: string;
  orderNumber?: string;
}

export interface CustomerPromotion {
  id: string;
  name: string;
  key?: string;
  discount: string;
  requiresDiscountCode: boolean;
  segmentVisible: boolean;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
}

export interface PromotionUsage {
  id: string;
  orderNumber: string;
  couponCode: string;
  promotionName: string;
  state: string;
  usedAt: string;
}
