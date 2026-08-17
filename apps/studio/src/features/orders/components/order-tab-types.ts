/**
 * Shared types for OrderDetailView tab sub-components.
 * Each tab receives the full order + relevant handlers to stay presentation-only.
 */
import type {
  Order,
  OrderState,
  ShipmentState,
  PaymentState,
  OrderAddress,
  OrderPayment,
} from "../types/order-types";
import { MOCK_CATALOG_PRODUCTS } from "../hooks/use-orders";

// ── General Tab ─────────────────────────────────────────────────────
export interface OrderGeneralTabProps {
  order: Order;
  fmtDate: (v?: string | null, style?: "date" | "full") => string;
  mounted: boolean;

  // State management form
  orderState: OrderState;
  setOrderState: (v: OrderState) => void;
  shipmentState: ShipmentState;
  setShipmentState: (v: ShipmentState) => void;
  paymentState: PaymentState;
  setPaymentState: (v: PaymentState) => void;
  stateSaveMsg: string;
  handleSaveStates: (e: React.FormEvent) => void;

  // Payment reminder
  altEmail: string;
  setAltEmail: (v: string) => void;
  paymentReminderFeedback: string;
  handleSendPaymentReminder: () => void;

  // Loyalty
  loyaltyPointsInput: string;
  setLoyaltyPointsInput: (v: string) => void;
  loyaltySavedDollars: number | null;
  handleCalculateLoyalty: () => void;

  // Line item quantities
  stagedLineQuantities: Record<string, number>;
  setStagedLineQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  handleUpdateLineItem: (lineItemId: string) => void;

  // Catalog search
  searchCatalogText: string;
  setSearchCatalogText: (v: string) => void;
  searchCatalogResults: typeof MOCK_CATALOG_PRODUCTS;
  handleCatalogSearch: (e: React.FormEvent) => void;
  searchSelectedQty: Record<string, number>;
  setSearchSelectedQty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  catalogFeedback: string;
  handleAddCatalogItemToOrder: (prod: typeof MOCK_CATALOG_PRODUCTS[number]) => void;

  // Gift & Discount
  giftMessageInput: string;
  setGiftMessageInput: (v: string) => void;
  giftMsgFeedback: string;
  handleSaveGiftMessage: () => void;
  selectedDiscountCode: string;
  setSelectedDiscountCode: (v: string) => void;
  discountFeedback: string;
  handleApplyDiscountCode: () => void;

  // Timeline
  orderTimeline: import("@/components/detail").TimelineItem[];
}

// ── Shipping Tab ────────────────────────────────────────────────────
export interface OrderShippingTabProps {
  order: Order;
  fmtDate: (v?: string | null, style?: "date" | "full") => string;
  selectedShippingMethodId: string;
  setSelectedShippingMethodId: (v: string) => void;
  shippingMethodFeedback: string;
  handleSaveShippingMethod: () => void;
  addressForm: OrderAddress;
  setAddressForm: React.Dispatch<React.SetStateAction<OrderAddress>>;
  addressFeedback: string;
  handleSaveShippingAddress: (e: React.FormEvent) => void;
}

// ── Returns Tab ─────────────────────────────────────────────────────
export interface OrderReturnsTabProps {
  order: Order;
  fmtDate: (v?: string | null, style?: "date" | "full") => string;
  isReturnDrawerOpen: boolean;
  handleOpenReturnDrawer: () => void;
  setIsReturnDrawerOpen: (v: boolean) => void;
  returnSelectedItems: Record<string, boolean>;
  setReturnSelectedItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  returnQuantities: Record<string, number>;
  setReturnQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  returnShipmentState: "Returned" | "Advised";
  setReturnShipmentState: (v: "Returned" | "Advised") => void;
  returnDateInput: string;
  setReturnDateInput: (v: string) => void;
  returnComment: string;
  setReturnComment: (v: string) => void;
  returnDrawerError: string;
  returnTrackingIdPreview: string;
  handleSubmitReturn: () => void;
}

// ── Payments Tab ────────────────────────────────────────────────────
export interface OrderPaymentsTabProps {
  order: Order;
  fmtDate: (v?: string | null, style?: "date" | "full") => string;
  selectedPaymentId: string | null;
  setSelectedPaymentId: (v: string | null) => void;
  selectedPayment: OrderPayment | null | undefined;
  paymentActionFeedback: string;
  handleGetLatestPspStatus: (paymentId: string) => void;
  handleSendPaymentLink: (paymentId: string) => void;
}

// ── Comments Tab ────────────────────────────────────────────────────
export interface OrderCommentsTabProps {
  order: Order;
  fmtDate: (v?: string | null, style?: "date" | "full") => string;
  showCommentForm: boolean;
  setShowCommentForm: (v: boolean) => void;
  commentInput: string;
  setCommentInput: (v: string) => void;
  handleAddComment: () => void;
}
