"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Button,
  Icon,
  Input,
  Select,
  FormField,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Drawer,
} from "@csa/ui";
import {
  DetailPage,
  BackLink,
  EntityHeader,
  EntityTabs,
  type EntityTab,
  SummaryGrid,
  SummaryCard,
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  CardAction,
  InfoList,
  InfoRow,
  StatusPill,
  type StatusTone,
  Timeline,
  type TimelineItem,
  type TimelineState,
  QuickActions,
  QuickAction,
  PrimaryButton,
  MoreActionsMenu,
  CardEmpty,
} from "@/components/detail";
import { useOrderStore, MOCK_SHIPPING_METHODS, MOCK_CATALOG_PRODUCTS, MOCK_AVAILABLE_DISCOUNTS } from "../hooks/use-orders";
import type {
  Order,
  OrderState,
  ShipmentState,
  PaymentState,
  OrderLineItem,
  OrderReturnItem,
  OrderAddress,
  OrderPayment,
} from "../types/order-types";

interface OrderDetailViewProps {
  id: string;
}

function createEmptyOrder(id: string): Order {
  return {
    billingAddress: {
      streetName: "--",
      city: "--",
      state: "--",
      postalCode: "--",
      country: "--",
    },
    comments: [],
    createdAt: "",
    customerEmail: "",
    customerName: "--",
    discountCodes: [],
    discountTotal: 0,
    grandTotal: 0,
    id,
    lastModifiedAt: "",
    lineItems: [],
    netTotal: 0,
    orderNumber: id,
    orderState: "Open",
    paymentState: "Pending",
    payments: [],
    returnInfo: [],
    shipmentState: "Pending",
    shippingAddress: {
      streetName: "--",
      city: "--",
      state: "--",
      postalCode: "--",
      country: "--",
    },
    shippingInfo: {
      shippingMethodName: "--",
      price: 0,
      taxRate: "--",
      carrier: "--",
      parcels: [],
    },
    shippingTotal: 0,
    store: "--",
    taxTotal: 0,
  };
}

const ORDER_STATE_OPTIONS = [
  { value: "Open", label: "Open" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Complete", label: "Complete" },
  { value: "Cancelled", label: "Cancelled" },
];

const SHIPMENT_STATE_OPTIONS = [
  { value: "Shipped", label: "Shipped" },
  { value: "Ready", label: "Ready" },
  { value: "Pending", label: "Pending" },
  { value: "Delayed", label: "Delayed" },
  { value: "Partial", label: "Partial" },
  { value: "Backorder", label: "Backorder" },
];

const PAYMENT_STATE_OPTIONS = [
  { value: "Paid", label: "Paid" },
  { value: "Pending", label: "Pending" },
  { value: "BalanceDue", label: "Balance Due" },
  { value: "Failed", label: "Failed" },
  { value: "CreditOwed", label: "Credit Owed" },
];

/** Shared status → tone map (spec): Open/Confirmed→info, Paid/Complete/Delivered/Shipped→success,
 * Pending/BalanceDue/Ready→warning, Failed/Cancelled→error, else neutral. */
function statusTone(status?: string | null): StatusTone {
  switch (status) {
    case "Open":
    case "Confirmed":
      return "info";
    case "Paid":
    case "Complete":
    case "Delivered":
    case "Shipped":
      return "success";
    case "Pending":
    case "BalanceDue":
    case "Ready":
      return "warning";
    case "Failed":
    case "Cancelled":
      return "error";
    default:
      return "neutral";
  }
}

function toTimelineState(tone: StatusTone): TimelineState {
  switch (tone) {
    case "success":
      return "complete";
    case "error":
      return "exception";
    case "info":
    case "primary":
    case "warning":
      return "current";
    default:
      return "waiting";
  }
}

function ProductThumbnail({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-12 h-12 bg-m-surface-2 border border-m-border rounded flex items-center justify-center text-[10px] font-bold text-m-text-muted shrink-0">
        NO IMG
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-12 h-12 object-contain rounded border border-m-border bg-white shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

export function OrderDetailView({ id }: OrderDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");
  const isB2b = pathname?.startsWith("/b2b");

  const {
    orders,
    loading,
    error,
    getOrderById,
    updateOrderStates,
    updateLineItemQuantity,
    addLineItemToOrder,
    duplicateOrder,
    sendPaymentReminder,
    redeemLoyaltyPoints,
    saveGiftMessage,
    applyDiscountCode,
    updateShippingMethod,
    updateShippingAddress,
    addReturnToOrder,
    refreshPaymentPspStatus,
    sendPaymentLink,
    addOrderComment,
  } = useOrderStore();

  const fallbackOrder = useMemo(() => createEmptyOrder(id), [id]);
  const order = getOrderById(id) || orders[0] || fallbackOrder;

  // Identical tab set across B2C and B2B — Custom Attributes content is folded
  // into the General tab below instead of living behind its own tab.
  const TABS: EntityTab[] = useMemo(
    () => [
      { id: "General", label: "General", icon: "layout-grid" },
      { id: "Shipping & Delivery", label: "Shipping & Delivery", icon: "truck" },
      { id: "Returns", label: "Returns", icon: "rotate-ccw", count: order.returnInfo?.length || 0 },
      { id: "Payments", label: "Payments", icon: "credit-card", count: order.payments?.length || 0 },
      { id: "Comments", label: "Comments", icon: "message-square", count: order.comments?.length || 0 },
    ],
    [order.returnInfo, order.payments, order.comments]
  );

  const [activeTab, setActiveTab] = useState<string>("General");

  // State Management Form
  const [orderState, setOrderState] = useState<OrderState>(order?.orderState || "Confirmed");
  const [shipmentState, setShipmentState] = useState<ShipmentState>(order?.shipmentState || "Ready");
  const [paymentState, setPaymentState] = useState<PaymentState>(order?.paymentState || "Paid");
  const [stateSaveMsg, setStateSaveMsg] = useState("");

  // Payment Reminder State
  const [altEmail, setAltEmail] = useState(order?.customerEmail || "");
  const [paymentReminderFeedback, setPaymentReminderFeedback] = useState("");

  // Loyalty Points State
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState("");
  const [loyaltySavedDollars, setLoyaltySavedDollars] = useState<number | null>(null);

  // Line Item Quantities (staged local state)
  const [stagedLineQuantities, setStagedLineQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    order?.lineItems.forEach((li) => {
      initial[li.id] = li.quantity;
    });
    return initial;
  });

  // Product Search Add State
  const [searchCatalogText, setSearchCatalogText] = useState("");
  const [searchCatalogResults, setSearchCatalogResults] = useState<typeof MOCK_CATALOG_PRODUCTS>([]);
  const [searchSelectedQty, setSearchSelectedQty] = useState<Record<string, number>>({});
  const [catalogFeedback, setCatalogFeedback] = useState("");

  // Gift Message & Discount Code State
  const [giftMessageInput, setGiftMessageInput] = useState(order?.giftMessage || "");
  const [giftMsgFeedback, setGiftMsgFeedback] = useState("");
  const [selectedDiscountCode, setSelectedDiscountCode] = useState("");
  const [discountFeedback, setDiscountFeedback] = useState("");

  // Shipping Method & Address Form State
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState(order?.shippingInfo.shippingMethodId || MOCK_SHIPPING_METHODS[0].id);
  const [shippingMethodFeedback, setShippingMethodFeedback] = useState("");

  const [addressForm, setAddressForm] = useState<OrderAddress>({
    streetNumber: order?.shippingAddress.streetNumber || "",
    streetName: order?.shippingAddress.streetName || "",
    building: order?.shippingAddress.building || "",
    city: order?.shippingAddress.city || "",
    state: order?.shippingAddress.state || "",
    postalCode: order?.shippingAddress.postalCode || "",
    country: order?.shippingAddress.country || "US",
  });
  const [addressFeedback, setAddressFeedback] = useState("");

  useEffect(() => {
    setOrderState(order.orderState);
    setShipmentState(order.shipmentState);
    setPaymentState(order.paymentState);
    setAltEmail(order.customerEmail || "");
    setGiftMessageInput(order.giftMessage || "");
    setSelectedShippingMethodId(order.shippingInfo.shippingMethodId || MOCK_SHIPPING_METHODS[0].id);
    setAddressForm({
      streetNumber: order.shippingAddress.streetNumber || "",
      streetName: order.shippingAddress.streetName || "",
      building: order.shippingAddress.building || "",
      city: order.shippingAddress.city || "",
      state: order.shippingAddress.state || "",
      postalCode: order.shippingAddress.postalCode || "",
      country: order.shippingAddress.country || "US",
    });
    setStagedLineQuantities(
      order.lineItems.reduce<Record<string, number>>((acc, lineItem) => {
        acc[lineItem.id] = lineItem.quantity;
        return acc;
      }, {})
    );
  }, [order]);

  // Returns Side Drawer State
  const [isReturnDrawerOpen, setIsReturnDrawerOpen] = useState(false);
  const [returnSelectedItems, setReturnSelectedItems] = useState<Record<string, boolean>>({});
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnShipmentState, setReturnShipmentState] = useState<"Returned" | "Advised">("Returned");
  const [returnDateInput, setReturnDateInput] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [returnDrawerError, setReturnDrawerError] = useState("");

  // Payments Tab State
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentActionFeedback, setPaymentActionFeedback] = useState("");

  // Comments Tab State
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentInput, setCommentInput] = useState("");

  // ── Actions ────────────────────────────────────────────────────────────

  const handleSaveStates = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrderStates(order.id, {
      orderState,
      shipmentState,
      paymentState,
    });
    setStateSaveMsg("Order status, shipment state, and payment state saved successfully.");
    setTimeout(() => setStateSaveMsg(""), 3500);
  };

  const handleSendPaymentReminder = () => {
    sendPaymentReminder(order.id, altEmail.trim());
    setPaymentReminderFeedback(`Payment reminder notification sent to ${altEmail.trim() || order.customerEmail}`);
    setTimeout(() => setPaymentReminderFeedback(""), 4000);
  };

  const handleCalculateLoyalty = () => {
    const pts = parseInt(loyaltyPointsInput.trim(), 10);
    if (!isNaN(pts) && pts > 0) {
      const saved = redeemLoyaltyPoints(order.id, pts);
      setLoyaltySavedDollars(saved);
    }
  };

  const handleUpdateLineItem = (lineItemId: string) => {
    const newQty = stagedLineQuantities[lineItemId] ?? 1;
    updateLineItemQuantity(order.id, lineItemId, newQty);
  };

  const handleCatalogSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchCatalogText.trim().toLowerCase();
    if (!q) {
      setSearchCatalogResults([]);
      return;
    }
    const results = MOCK_CATALOG_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    );
    setSearchCatalogResults(results);
    const initialQty: Record<string, number> = {};
    results.forEach((r) => {
      initialQty[r.productId] = 1;
    });
    setSearchSelectedQty(initialQty);
  };

  const handleAddCatalogItemToOrder = (prod: typeof MOCK_CATALOG_PRODUCTS[number]) => {
    const qty = searchSelectedQty[prod.productId] || 1;
    addLineItemToOrder(order.id, {
      productId: prod.productId,
      key: prod.key,
      name: prod.name,
      sku: prod.sku,
      imageUrl: prod.imageUrl,
      unitPrice: prod.unitPrice,
      quantity: qty,
    });
    setCatalogFeedback(`Added ${qty} × ${prod.name} to order.`);
    setTimeout(() => setCatalogFeedback(""), 3500);
  };

  const handleSaveGiftMessage = () => {
    saveGiftMessage(order.id, giftMessageInput.trim());
    setGiftMsgFeedback("Gift message saved to order.");
    setTimeout(() => setGiftMsgFeedback(""), 3000);
  };

  const handleApplyDiscountCode = () => {
    if (!selectedDiscountCode) return;
    applyDiscountCode(order.id, selectedDiscountCode);
    setDiscountFeedback(`Applied code ${selectedDiscountCode}.`);
    setSelectedDiscountCode("");
    setTimeout(() => setDiscountFeedback(""), 3500);
  };

  const handleSaveShippingMethod = () => {
    const method = MOCK_SHIPPING_METHODS.find((m) => m.id === selectedShippingMethodId);
    if (method) {
      updateShippingMethod(order.id, method.id, method.name);
      setShippingMethodFeedback(`Shipping method updated to ${method.name}.`);
      setTimeout(() => setShippingMethodFeedback(""), 3500);
    }
  };

  const handleSaveShippingAddress = (e: React.FormEvent) => {
    e.preventDefault();
    updateShippingAddress(order.id, addressForm);
    setAddressFeedback("Shipping address updated successfully.");
    setTimeout(() => setAddressFeedback(""), 3500);
  };

  const handleOpenReturnDrawer = () => {
    if (order.orderState !== "Complete" || order.shipmentState !== "Shipped") {
      alert("Returns can only be created once the order status is Complete and the shipment status is Shipped.");
      return;
    }
    const initialSelected: Record<string, boolean> = {};
    const initialQty: Record<string, number> = {};
    order.lineItems.forEach((li) => {
      initialSelected[li.id] = false;
      initialQty[li.id] = 1;
    });
    setReturnSelectedItems(initialSelected);
    setReturnQuantities(initialQty);
    setReturnDateInput(new Date().toISOString().slice(0, 10));
    setReturnComment("");
    setReturnDrawerError("");
    setIsReturnDrawerOpen(true);
  };

  const handleSubmitReturn = () => {
    const returnItemsToSubmit: Omit<OrderReturnItem, "id" | "createdAt">[] = [];

    order.lineItems.forEach((li) => {
      if (returnSelectedItems[li.id]) {
        const qty = returnQuantities[li.id] || 1;
        returnItemsToSubmit.push({
          lineItemId: li.id,
          name: li.name,
          sku: li.sku,
          key: li.key,
          imageUrl: li.imageUrl,
          quantity: qty,
          shipmentState: returnShipmentState,
          paymentState: "Refunded",
          comment: returnComment,
        });
      }
    });

    if (returnItemsToSubmit.length === 0) {
      setReturnDrawerError("Please select at least one line item to return.");
      return;
    }

    addReturnToOrder(
      order.id,
      returnItemsToSubmit,
      returnComment,
      returnDateInput ? `${returnDateInput}T09:00:00Z` : undefined,
      returnShipmentState
    );
    setIsReturnDrawerOpen(false);
  };

  const handleGetLatestPspStatus = (paymentId: string) => {
    const nextStatus = refreshPaymentPspStatus(order.id, paymentId);
    setPaymentActionFeedback(`Updated PSP payment status to "${nextStatus}".`);
    setTimeout(() => setPaymentActionFeedback(""), 3500);
  };

  const handleSendPaymentLink = (paymentId: string) => {
    sendPaymentLink(order.id, paymentId, order.customerId);
    setPaymentActionFeedback(`Payment link email sent to ${order.customerEmail}.`);
    setTimeout(() => setPaymentActionFeedback(""), 3500);
  };

  const handleAddComment = () => {
    if (!commentInput.trim()) return;
    addOrderComment(order.id, commentInput.trim(), "Support Agent");
    setCommentInput("");
    setShowCommentForm(false);
  };

  const handleDuplicateOrder = () => {
    const cartId = duplicateOrder(order.id);
    router.push(`/cart/${cartId}`);
  };

  // ── Derived view data ───────────────────────────────────────────────────

  const selectedPayment = selectedPaymentId
    ? order.payments.find((p) => p.id === selectedPaymentId)
    : null;

  const returnTrackingIdPreview = `RTN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${order.orderNumber}-${(order.returnInfo?.length || 0) + 1}`;

  // Real-data-driven fulfillment overview — derived purely from orderState /
  // paymentState / shipmentState, never fabricated.
  const orderTimeline: TimelineItem[] = useMemo(
    () => [
      {
        label: "Order Placed",
        meta: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : undefined,
        state: order.orderState === "Cancelled" ? "exception" : "complete",
      },
      {
        label: "Payment",
        meta: order.paymentState,
        state: toTimelineState(statusTone(order.paymentState)),
      },
      {
        label: "Shipment",
        meta: order.shipmentState,
        detail:
          order.shippingInfo.parcels.length > 0
            ? `${order.shippingInfo.parcels.length} parcel(s) dispatched`
            : undefined,
        state: toTimelineState(statusTone(order.shipmentState)),
      },
    ],
    [order.createdAt, order.orderState, order.paymentState, order.shipmentState, order.shippingInfo.parcels.length]
  );

  const backHref = customerIdParam ? `/customers/${customerIdParam}` : isB2b ? "/b2b/orders" : "/orders";
  const backLabel = customerIdParam ? "Go back to customer" : isB2b ? "To order list" : "Back to Orders";

  return (
    <DetailPage>
      <BackLink href={backHref}>{backLabel}</BackLink>

      <EntityHeader
        title={order?.orderNumber ? `Order #${order.orderNumber}` : "Order Detail"}
        status={<StatusPill tone={statusTone(order.orderState)}>{order.orderState}</StatusPill>}
        meta={`Placed ${order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"} • ${
          order.store && order.store !== "--" ? order.store : "—"
        }${order.companyName ? ` • ${order.companyName}` : ""}`}
        actions={
          <>
            <MoreActionsMenu
              actions={[
                {
                  id: "view-customer",
                  label: "View Customer",
                  icon: "user",
                  disabled: !order.customerId,
                  onClick: () => order.customerId && router.push(`/customers/${order.customerId}`),
                },
                {
                  id: "create-return",
                  label: "Create Return",
                  icon: "rotate-ccw",
                  onClick: () => {
                    setActiveTab("Returns");
                    handleOpenReturnDrawer();
                  },
                },
                {
                  id: "add-comment",
                  label: "Add Comment",
                  icon: "message-square",
                  onClick: () => {
                    setActiveTab("Comments");
                    setShowCommentForm(true);
                  },
                },
              ]}
            />
            <PrimaryButton icon="copy" onClick={handleDuplicateOrder}>
              {isB2b ? "Copy Order" : "Duplicate Order"}
            </PrimaryButton>
          </>
        }
      />

      {(loading || error) && (
        <div
          className={`rounded-m-lg border px-3.5 py-2.5 text-[12.5px] font-semibold ${
            error
              ? "border-m-error-border bg-m-error-light text-m-error"
              : "border-m-border bg-m-surface-2 text-m-text-muted"
          }`}
        >
          {error
            ? "Unable to load this order from the BFF. Showing available local order state."
            : "Loading order data from the BFF..."}
        </div>
      )}

      <EntityTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* ── Tab 1: General ── */}
      {activeTab === "General" && (
        <>
          <SummaryGrid>
            <SummaryCard
              icon="calendar"
              label="Order Date"
              value={order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "--"}
              sub={order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : undefined}
            />
            <SummaryCard icon="hash" label="Order Number" value={order.orderNumber} />
            <SummaryCard icon="shopping-bag" label="Sales Channel" value={order.store} />
            <SummaryCard icon="user" label="Customer" value={order.customerName} sub={order.customerEmail} />
            <SummaryCard
              icon="dollar-sign"
              label="Total Amount"
              value={`$${order.grandTotal.toFixed(2)}`}
              tone="primary"
            />
            <SummaryCard
              icon="credit-card"
              label="Payment Status"
              value={<StatusPill tone={statusTone(order.paymentState)}>{order.paymentState}</StatusPill>}
            />
          </SummaryGrid>

          <ContentGrid>
            <MainColumn>
              {!isB2b && (
                <SectionCard title="Send Payment Notification" icon="mail">
                  <div className="space-y-3">
                    <p className="text-xs text-m-text-muted">
                      Send an automated payment link reminder to the customer&apos;s registered email address.
                    </p>
                    {paymentReminderFeedback && (
                      <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                        {paymentReminderFeedback}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                      <div className="flex-1 w-full">
                        <FormField>
                          <Label>Alternate Email</Label>
                          <Input
                            value={altEmail}
                            onChange={(e) => setAltEmail(e.target.value)}
                            placeholder="Enter email address..."
                          />
                        </FormField>
                      </div>
                      <Button type="button" variant="primary" size="md" onClick={handleSendPaymentReminder}>
                        Send Payment Reminder
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SectionCard title="Order Status Management" icon="settings">
                  <form onSubmit={handleSaveStates} className="space-y-4">
                    {stateSaveMsg && (
                      <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                        {stateSaveMsg}
                      </div>
                    )}

                    <FormField>
                      <Label>Order Number</Label>
                      <Input value={order.orderNumber} readOnly className="bg-m-surface-2" />
                    </FormField>

                    <FormField>
                      <Label>Order Status</Label>
                      <Select
                        value={orderState}
                        onChange={(e) => setOrderState(e.target.value as OrderState)}
                        options={ORDER_STATE_OPTIONS}
                      />
                    </FormField>

                    <FormField>
                      <Label>Payment Status</Label>
                      <Select
                        value={paymentState}
                        onChange={(e) => setPaymentState(e.target.value as PaymentState)}
                        options={PAYMENT_STATE_OPTIONS}
                      />
                    </FormField>

                    <FormField>
                      <Label>Shipment Status</Label>
                      <Select
                        value={shipmentState}
                        onChange={(e) => setShipmentState(e.target.value as ShipmentState)}
                        options={SHIPMENT_STATE_OPTIONS}
                      />
                    </FormField>

                    <div className="flex items-center gap-3 pt-2">
                      <Button type="submit" variant="primary" size="md">
                        Save Changes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          setOrderState(order.orderState);
                          setShipmentState(order.shipmentState);
                          setPaymentState(order.paymentState);
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Financial Breakdown" icon="receipt">
                  <div className="flex flex-col justify-between h-full space-y-4">
                    <div className="divide-y divide-m-border text-xs">
                      <div className="flex justify-between items-center py-2.5">
                        <span className="text-m-text-muted font-medium">Order original subtotal</span>
                        <span className="font-semibold text-m-text">${order.netTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5">
                        <span className="text-m-text-muted font-medium">Tax (merchandise)</span>
                        <span className="font-semibold text-m-text">+${order.taxTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5">
                        <span className="text-m-text font-semibold">Merchandise total (gross)</span>
                        <span className="font-bold text-m-text">${(order.netTotal + order.taxTotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5">
                        <span className="text-m-text-muted font-medium">+ Shipping cost</span>
                        <span className="font-semibold text-m-text">${order.shippingTotal.toFixed(2)}</span>
                      </div>
                      {order.discountTotal > 0 && (
                        <div className="flex justify-between items-center py-2.5 text-m-success">
                          <span className="font-medium">- Applied discounts</span>
                          <span className="font-bold">-${order.discountTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t-2 border-m-border mt-auto">
                      <span className="text-sm font-bold text-m-text">Order final total</span>
                      <span className="text-xl font-extrabold text-m-primary">${order.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </SectionCard>
              </div>

              {!isB2b && (
                <SectionCard title="Redeem Loyalty Points" icon="star">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-m-text-muted">
                      Total Loyalty Points Available: <span className="font-bold text-m-primary font-mono">1,434,321</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                      <div className="flex-1 w-full">
                        <FormField>
                          <Label>Points to Redeem</Label>
                          <Input
                            value={loyaltyPointsInput}
                            onChange={(e) => setLoyaltyPointsInput(e.target.value)}
                            placeholder="Enter points to Redeem (e.g. 1000)"
                          />
                        </FormField>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="primary" size="md" onClick={handleCalculateLoyalty}>
                          Calculate
                        </Button>
                        {loyaltySavedDollars !== null && (
                          <div className="px-3 py-2 bg-m-success-light text-m-success-dark font-bold rounded-m-md border border-m-success-border text-xs">
                            Amount Saved: ${loyaltySavedDollars.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </SectionCard>
              )}

              <SectionCard
                title={isB2b ? "Customer Details" : "Customer & Addresses"}
                icon="user"
                action={
                  order.customerId && (
                    <CardAction onClick={() => router.push(`/customers/${order.customerId}`)}>
                      View Profile →
                    </CardAction>
                  )
                }
              >
                <div className="space-y-4">
                  <div className="p-3 bg-m-surface-2 rounded-m-lg border border-m-border flex items-center gap-2 text-xs">
                    <Icon name="mail" size="xs" />
                    <span className="font-semibold text-m-text">Customer email:</span>
                    <span className="font-bold text-m-primary">{order.customerEmail || "—"}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-m-primary font-bold text-xs">
                        <Icon name="home" size="xs" />
                        <span>Shipping Address</span>
                      </div>
                      <InfoList>
                        <InfoRow label="Name" value={order.customerName} />
                        <InfoRow
                          label="Street"
                          value={[order.shippingAddress.streetNumber, order.shippingAddress.streetName, order.shippingAddress.building]
                            .filter(Boolean)
                            .join(" ")}
                        />
                        <InfoRow
                          label="City / State / ZIP"
                          value={[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode]
                            .filter((v) => v && v !== "--")
                            .join(", ")}
                        />
                        <InfoRow label="Country" value={order.shippingAddress.country} />
                      </InfoList>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-m-primary font-bold text-xs">
                        <Icon name="file-text" size="xs" />
                        <span>Billing Address</span>
                      </div>
                      <InfoList>
                        <InfoRow label="Name" value={order.customerName} />
                        <InfoRow
                          label="Street"
                          value={[order.billingAddress.streetNumber, order.billingAddress.streetName, order.billingAddress.building]
                            .filter(Boolean)
                            .join(" ")}
                        />
                        <InfoRow
                          label="City / State / ZIP"
                          value={[order.billingAddress.city, order.billingAddress.state, order.billingAddress.postalCode]
                            .filter((v) => v && v !== "--")
                            .join(", ")}
                        />
                        <InfoRow label="Country" value={order.billingAddress.country} />
                      </InfoList>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={`Order Items (${order.lineItems.length})`} icon="package" bodyClassName="p-0">
                {order.lineItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead></TableHead>
                        <TableHead>Sub Total</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead className="text-right">Total Gross</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.lineItems.map((item: OrderLineItem) => (
                        <TableRow key={item.id}>
                          <TableCell className="flex items-center gap-3">
                            <ProductThumbnail src={item.imageUrl} />
                            <div>
                              <div className="font-bold text-xs text-m-text">{item.name}</div>
                              <div className="text-[10px] text-m-text-muted font-mono">
                                SKU: {item.sku} {item.key ? `· Key: ${item.key}` : ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-m-text">${item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="w-20">
                              <Input
                                type="number"
                                min={1}
                                value={stagedLineQuantities[item.id] ?? item.quantity}
                                onChange={(e) =>
                                  setStagedLineQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: Number(e.target.value),
                                  }))
                                }
                                className="text-xs text-center"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={(stagedLineQuantities[item.id] ?? item.quantity) === item.quantity}
                              onClick={() => handleUpdateLineItem(item.id)}
                            >
                              Update
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs font-medium">${item.subtotal.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-m-text-muted">${item.tax.toFixed(2)}</TableCell>
                          <TableCell className="text-xs font-bold text-m-text text-right">
                            ${item.totalGross.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <CardEmpty
                    icon="package"
                    title="No line items on this order"
                    hint="The commerce backend did not return any line items for this order."
                  />
                )}
              </SectionCard>

              <SectionCard title="Add Line Items" icon="plus-circle">
                <div className="space-y-4">
                  {catalogFeedback && (
                    <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                      {catalogFeedback}
                    </div>
                  )}
                  <form onSubmit={handleCatalogSearch} className="space-y-2">
                    <Label>Search products by name or SKU</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Input
                          value={searchCatalogText}
                          onChange={(e) => setSearchCatalogText(e.target.value)}
                          placeholder="Type product name (e.g. Chair, Headphones, Keyboard)..."
                        />
                      </div>
                      <Button type="submit" variant="primary" size="md">
                        Search
                      </Button>
                    </div>
                  </form>

                  {searchCatalogResults.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchCatalogResults.map((prod) => (
                          <TableRow key={prod.productId}>
                            <TableCell className="flex items-center gap-3">
                              <ProductThumbnail src={prod.imageUrl} />
                              <div>
                                <div className="font-bold text-xs text-m-text">{prod.name}</div>
                                <div className="text-[10px] text-m-text-muted font-mono">
                                  SKU: {prod.sku} · Key: {prod.key}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">${prod.unitPrice.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="w-20">
                                <Input
                                  type="number"
                                  min={1}
                                  value={searchSelectedQty[prod.productId] || 1}
                                  onChange={(e) =>
                                    setSearchSelectedQty((prev) => ({
                                      ...prev,
                                      [prod.productId]: Number(e.target.value),
                                    }))
                                  }
                                  className="text-xs text-center"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAddCatalogItemToOrder(prod)}
                              >
                                + Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </SectionCard>

              {!isB2b && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <SectionCard title="Gift Message" icon="gift">
                    <div className="space-y-3">
                      {giftMsgFeedback && (
                        <div className="p-2 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                          {giftMsgFeedback}
                        </div>
                      )}
                      <FormField>
                        <textarea
                          className="w-full p-2.5 border border-m-border rounded-m-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                          rows={3}
                          value={giftMessageInput}
                          onChange={(e) => setGiftMessageInput(e.target.value)}
                          placeholder="Enter special gift note for recipient..."
                        />
                      </FormField>
                      <Button type="button" variant="primary" size="sm" onClick={handleSaveGiftMessage}>
                        Save Gift Message
                      </Button>
                    </div>
                  </SectionCard>

                  <SectionCard title="Add Discount Codes" icon="tag">
                    <div className="space-y-4">
                      {discountFeedback && (
                        <div className="p-2 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                          {discountFeedback}
                        </div>
                      )}
                      <FormField>
                        <Label>Select Discount Code</Label>
                        <Select
                          value={selectedDiscountCode}
                          onChange={(e) => setSelectedDiscountCode(e.target.value)}
                          options={[
                            { value: "", label: "Select discount code..." },
                            ...MOCK_AVAILABLE_DISCOUNTS.map((d) => ({
                              value: d.code,
                              label: `${d.code} — ${d.name} (${d.value})`,
                            })),
                          ]}
                        />
                      </FormField>

                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={!selectedDiscountCode}
                          onClick={handleApplyDiscountCode}
                        >
                          Apply Discount Code
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedDiscountCode("")}
                        >
                          Reset
                        </Button>
                      </div>

                      {/* Applied discounts */}
                      {order.appliedDiscounts && order.appliedDiscounts.length > 0 && (
                        <div className="pt-3 border-t border-m-border space-y-1">
                          <span className="text-[10px] font-bold text-m-success-dark uppercase tracking-wider block">
                            Applied Discounts
                          </span>
                          {order.appliedDiscounts.map((row) => (
                            <div key={row.code} className="text-xs font-semibold text-m-text">
                              {row.code} {row.name ? `— ${row.name}` : ""} ({row.savings} saved)
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ineffective discounts */}
                      {order.ineffectiveDiscounts && order.ineffectiveDiscounts.length > 0 && (
                        <div className="pt-3 border-t border-m-border space-y-1">
                          <span className="text-[10px] font-bold text-m-warning-dark uppercase tracking-wider block">
                            Not Applied
                          </span>
                          {order.ineffectiveDiscounts.map((row) => (
                            <div key={row.code} className="text-xs text-m-text-muted">
                              <span className="font-bold text-m-text">{row.code}:</span> {row.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>
              )}

              {isB2b && (
                <SectionCard title="Custom Fields & Metadata" icon="list">
                  {order.customFields && order.customFields.length > 0 ? (
                    <InfoList columns={2}>
                      {order.customFields.map((field) => (
                        <InfoRow key={field.name} label={field.name} value={String(field.value)} />
                      ))}
                    </InfoList>
                  ) : (
                    <CardEmpty
                      icon="list"
                      title="No custom fields"
                      hint="There are no custom fields attached to this order."
                    />
                  )}
                </SectionCard>
              )}
            </MainColumn>

            <SideColumn>
              <QuickActions>
                <QuickAction icon="copy" label={isB2b ? "Copy Order" : "Duplicate Order"} onClick={handleDuplicateOrder} />
                <QuickAction
                  icon="user"
                  label="View Customer"
                  disabled={!order.customerId}
                  onClick={() => order.customerId && router.push(`/customers/${order.customerId}`)}
                />
                <QuickAction
                  icon="rotate-ccw"
                  label="Create Return"
                  onClick={() => {
                    setActiveTab("Returns");
                    handleOpenReturnDrawer();
                  }}
                />
                <QuickAction
                  icon="message-square"
                  label="Add Comment"
                  onClick={() => {
                    setActiveTab("Comments");
                    setShowCommentForm(true);
                  }}
                />
              </QuickActions>

              <SectionCard title="Fulfillment Timeline" icon="activity">
                <Timeline items={orderTimeline} />
              </SectionCard>
            </SideColumn>
          </ContentGrid>
        </>
      )}

      {/* ── Tab 2: Shipping & Delivery ── */}
      {activeTab === "Shipping & Delivery" && (
        <ContentGrid>
          <MainColumn>
            <SectionCard title="Shipping Method" icon="truck">
              <div className="space-y-4">
                {shippingMethodFeedback && (
                  <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                    {shippingMethodFeedback}
                  </div>
                )}
                <FormField>
                  <Label>Select Shipping Method</Label>
                  <Select
                    value={selectedShippingMethodId}
                    onChange={(e) => setSelectedShippingMethodId(e.target.value)}
                    options={MOCK_SHIPPING_METHODS.map((m) => ({
                      value: m.id,
                      label: `${m.name} — $${m.price.toFixed(2)} (${m.carrier})`,
                    }))}
                  />
                </FormField>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="primary" size="md" onClick={handleSaveShippingMethod}>
                    Save Shipping Method
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setSelectedShippingMethodId(order.shippingInfo.shippingMethodId || MOCK_SHIPPING_METHODS[0].id)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Shipping Details & Address" icon="map-pin">
              <form onSubmit={handleSaveShippingAddress} className="space-y-4">
                {addressFeedback && (
                  <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
                    {addressFeedback}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField>
                    <Label>Shipped Quantity</Label>
                    <Input
                      value={String(order.lineItems.reduce((acc, li) => acc + li.quantity, 0))}
                      readOnly
                      className="bg-m-surface-2"
                    />
                  </FormField>
                  <FormField>
                    <Label>Shipping Tax</Label>
                    <Input value={`$${(order.shippingInfo.price * 0.08).toFixed(2)}`} readOnly className="bg-m-surface-2" />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField>
                    <Label>Street Number</Label>
                    <Input
                      value={addressForm.streetNumber || ""}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, streetNumber: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>Street Name</Label>
                    <Input
                      value={addressForm.streetName}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, streetName: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>Building</Label>
                    <Input
                      value={addressForm.building || ""}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, building: e.target.value }))}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField>
                    <Label>City</Label>
                    <Input
                      value={addressForm.city}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>State</Label>
                    <Input
                      value={addressForm.state}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))}
                    />
                  </FormField>
                  <FormField>
                    <Label>Postal Code</Label>
                    <Input
                      value={addressForm.postalCode}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                    />
                  </FormField>
                </div>

                <FormField>
                  <Label>Country</Label>
                  <Input
                    value={addressForm.country}
                    onChange={(e) => setAddressForm((prev) => ({ ...prev, country: e.target.value }))}
                  />
                </FormField>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" variant="primary" size="md">
                    Update Address
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setAddressForm(order.shippingAddress)}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard title={`Deliveries (${order.shippingInfo.parcels.length})`} icon="box">
              {order.shippingInfo.parcels.length > 0 ? (
                <div className="divide-y divide-m-border text-xs">
                  {order.shippingInfo.parcels.map((parcel, idx) => (
                    <div key={parcel.id} className="py-3 space-y-1">
                      <span className="font-bold text-m-text">Delivery #{idx + 1} (ID: {parcel.id})</span>
                      <div className="text-m-text-muted">Items Shipped: {parcel.itemsCount}</div>
                      <div className="text-m-primary font-mono font-bold pt-1">
                        Tracking ID:{" "}
                        <a
                          href={`https://www.fedex.com/fedextrack/?trknbr=${parcel.trackingId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {parcel.trackingId}
                        </a>{" "}
                        ({parcel.carrier})
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <CardEmpty
                  icon="box"
                  title="No deliveries yet"
                  hint="Parcel tracking information will appear here once a shipment is dispatched."
                />
              )}
            </SectionCard>
          </MainColumn>

          <SideColumn>
            <SectionCard title="Shipment Status" icon="activity">
              <Timeline items={orderTimeline} />
            </SectionCard>

            <SectionCard title="Shipping Summary" icon="info">
              <InfoList>
                <InfoRow label="Method" value={order.shippingInfo.shippingMethodName} />
                <InfoRow label="Carrier" value={order.shippingInfo.carrier} />
                <InfoRow label="Tax Rate" value={order.shippingInfo.taxRate} />
                <InfoRow label="Shipping Cost" value={`$${order.shippingInfo.price.toFixed(2)}`} />
              </InfoList>
            </SectionCard>
          </SideColumn>
        </ContentGrid>
      )}

      {/* ── Tab 3: Returns ── */}
      {activeTab === "Returns" && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-end">
            <PrimaryButton icon="plus" onClick={handleOpenReturnDrawer}>
              Create Order Return
            </PrimaryButton>
          </div>

          {order.returnInfo && order.returnInfo.length > 0 ? (
            order.returnInfo.map((ret, idx) => (
              <SectionCard
                key={ret.returnTrackingId || idx}
                title={`Return Request #${idx + 1}`}
                icon="rotate-ccw"
                action={
                  <span className="text-[11px] font-mono text-m-text-muted">
                    {ret.returnTrackingId} • {new Date(ret.returnDate).toLocaleString()}
                  </span>
                }
                bodyClassName="p-0"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Shipment State</TableHead>
                      <TableHead>Payment State</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead>Comment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ret.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="flex items-center gap-3">
                          <ProductThumbnail src={item.imageUrl} />
                          <div>
                            <div className="font-bold text-xs text-m-text">{item.name}</div>
                            <div className="text-[10px] text-m-text-muted font-mono">
                              SKU: {item.sku} {item.key ? `· Key: ${item.key}` : ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">{item.quantity}</TableCell>
                        <TableCell>
                          <StatusPill tone={statusTone(item.shipmentState)}>{item.shipmentState}</StatusPill>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={statusTone(item.paymentState)}>{item.paymentState}</StatusPill>
                        </TableCell>
                        <TableCell className="text-xs text-m-text-muted">
                          {new Date(item.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-m-text-muted">{item.comment || "--"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            ))
          ) : (
            <SectionCard title="Returns" icon="rotate-ccw">
              <CardEmpty
                icon="rotate-ccw"
                title="No return records"
                hint='No return records recorded for this order. Click "Create Order Return" to initiate an RMA.'
              />
            </SectionCard>
          )}

          {/* Create Return Side Drawer */}
          <Drawer
            isOpen={isReturnDrawerOpen}
            onClose={() => setIsReturnDrawerOpen(false)}
            size="lg"
            position="right"
          >
            <Drawer.Header
              title="New Return Info"
              subtitle="Select ordered items and quantities to initiate an RMA request."
              onClose={() => setIsReturnDrawerOpen(false)}
            />
            <Drawer.Content className="space-y-4">
              {returnDrawerError && (
                <div className="p-2.5 bg-m-error-light text-m-error border border-m-error-border text-xs font-semibold rounded-m-md">
                  {returnDrawerError}
                </div>
              )}

              <FormField>
                <Label>Return Tracking Id</Label>
                <Input value={returnTrackingIdPreview} readOnly className="bg-m-surface-2 font-mono text-xs" />
              </FormField>

              <FormField>
                <Label>Return Date</Label>
                <Input
                  type="date"
                  value={returnDateInput}
                  onChange={(e) => setReturnDateInput(e.target.value)}
                />
              </FormField>

              <FormField>
                <Label>Shipment State</Label>
                <Select
                  value={returnShipmentState}
                  onChange={(e) => setReturnShipmentState(e.target.value as "Returned" | "Advised")}
                  options={[
                    { value: "Returned", label: "Returned (Warehouse received)" },
                    { value: "Advised", label: "Advised (RMA issued)" },
                  ]}
                />
              </FormField>

              <div>
                <Label>Ordered Items</Label>
                <p className="text-[11px] text-m-text-muted mb-2">
                  Select the items that should be grouped together in one return.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Return Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={Boolean(returnSelectedItems[li.id])}
                            onChange={(e) =>
                              setReturnSelectedItems((prev) => ({ ...prev, [li.id]: e.target.checked }))
                            }
                            className="rounded border-m-border"
                          />
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          <ProductThumbnail src={li.imageUrl} />
                          <div>
                            <div className="font-semibold text-xs">{li.name}</div>
                            <div className="text-[10px] text-m-text-muted font-mono">{li.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-m-text-muted">{li.quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={li.quantity}
                            disabled={!returnSelectedItems[li.id]}
                            value={returnQuantities[li.id] || 1}
                            onChange={(e) =>
                              setReturnQuantities((prev) => ({
                                ...prev,
                                [li.id]: Number(e.target.value),
                              }))
                            }
                            className="w-16 text-xs text-center"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <FormField>
                <Label>Comment</Label>
                <textarea
                  className="w-full p-2.5 border border-m-border rounded-m-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                  rows={2}
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                  placeholder="Reason for return..."
                />
              </FormField>
            </Drawer.Content>
            <Drawer.Footer>
              <Button variant="secondary" size="md" onClick={() => setIsReturnDrawerOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleSubmitReturn}>
                Submit Return
              </Button>
            </Drawer.Footer>
          </Drawer>
        </div>
      )}

      {/* ── Tab 4: Payments ── */}
      {activeTab === "Payments" && (
        <div className="flex flex-col gap-5">
          {paymentActionFeedback && (
            <div className="p-2.5 bg-m-success-light text-m-success border border-m-success-border text-xs font-semibold rounded-m-md">
              {paymentActionFeedback}
            </div>
          )}

          <SectionCard title="Payment Transactions" icon="credit-card" bodyClassName={order.payments && order.payments.length > 0 ? "p-0" : undefined}>
            {order.payments && order.payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Id</TableHead>
                    <TableHead>Interface Id</TableHead>
                    <TableHead>Amount planned</TableHead>
                    <TableHead>Payment method info</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((p: OrderPayment) => (
                    <TableRow
                      key={p.id}
                      clickable
                      onClick={() => setSelectedPaymentId(selectedPaymentId === p.id ? null : p.id)}
                    >
                      <TableCell className="font-mono text-xs font-bold text-m-primary">{p.id}</TableCell>
                      <TableCell className="font-mono text-xs text-m-text-muted">{p.interfaceId}</TableCell>
                      <TableCell className="font-bold text-xs">${p.amountPlanned.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-m-text">
                        <div>Name: {p.method}</div>
                        <div>PSP: {p.psp}</div>
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {new Date(p.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {new Date(p.lastModifiedAt || p.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <CardEmpty
                icon="credit-card"
                title="No payment records"
                hint="There are no payment records associated with this order."
              />
            )}
          </SectionCard>

          {/* Payment Detail Panel (Expandable) */}
          {selectedPayment && (
            <SectionCard
              title={`Payment ID: ${selectedPayment.id}`}
              icon="receipt"
              className="border-l-4 border-l-m-primary"
              action={
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedPaymentId(null)}>
                    Close
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleGetLatestPspStatus(selectedPayment.id)}>
                    Get latest status
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Icon name="mail" size="xs" />}
                    onClick={() => handleSendPaymentLink(selectedPayment.id)}
                  >
                    Send payment link
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <span className="text-[11px] text-m-text-muted block -mt-2">
                  Created: {new Date(selectedPayment.createdAt).toLocaleString()}
                </span>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-m-text-muted block">Payment Method Name</span>
                    <span className="font-semibold text-m-text">{selectedPayment.method}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">PSP Provider</span>
                    <span className="font-semibold text-m-text">{selectedPayment.psp}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">Interface ID</span>
                    <span className="font-mono text-m-text">{selectedPayment.interfaceId}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">Amount Planned</span>
                    <span className="font-bold text-m-text">${selectedPayment.amountPlanned.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-m-text-muted block">PSP Payment Status</span>
                    <StatusPill tone={statusTone(selectedPayment.pspPaymentStatus)}>
                      {selectedPayment.pspPaymentStatus}
                    </StatusPill>
                  </div>
                </div>

                <div className="pt-2 border-t border-m-border">
                  <h4 className="text-xs font-bold text-m-text mb-2">Transactions Breakdown</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Transaction type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Interaction ID</TableHead>
                        <TableHead>Transaction ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPayment.transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-xs text-m-text-muted">
                            {new Date(txn.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-semibold text-xs">{txn.type}</TableCell>
                          <TableCell>
                            <StatusPill tone={statusTone(txn.state)}>{txn.state}</StatusPill>
                          </TableCell>
                          <TableCell className="font-bold text-xs">${txn.amount.toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs text-m-text-muted">{txn.interactionId}</TableCell>
                          <TableCell className="font-mono text-xs text-m-text-muted">{txn.id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Tab 5: Comments ── */}
      {activeTab === "Comments" && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-end">
            <PrimaryButton icon={showCommentForm ? "x" : "plus"} onClick={() => setShowCommentForm(!showCommentForm)}>
              {showCommentForm ? "Cancel Comment" : "Add Comment"}
            </PrimaryButton>
          </div>

          {showCommentForm && (
            <SectionCard title="Add New Order Comment" icon="message-square">
              <div className="space-y-3">
                <FormField>
                  <textarea
                    className="w-full p-3 border border-m-border rounded-m-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                    rows={3}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add internal order note or customer service update..."
                  />
                </FormField>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="primary" size="md" onClick={handleAddComment}>
                    Submit Comment
                  </Button>
                  <Button type="button" variant="secondary" size="md" onClick={() => setShowCommentForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title={`Order Notes & History (${order.comments?.length || 0})`} icon="message-square">
            {order.comments && order.comments.length > 0 ? (
              <div className="space-y-3">
                {order.comments.map((c) => (
                  <div key={c.id} className="p-3 bg-m-surface-2 border border-m-border rounded-m-md text-xs space-y-1">
                    <div className="flex items-center justify-between text-m-text-muted">
                      <span className="font-bold text-m-text">{c.author}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-m-text leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <CardEmpty
                icon="message-square"
                title="No comments yet"
                hint="There are no comments attached to this order yet."
              />
            )}
          </SectionCard>
        </div>
      )}
    </DetailPage>
  );
}
