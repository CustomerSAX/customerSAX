"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  DetailPage,
  BackLink,
  EntityHeader,
  EntityTabs,
  type EntityTab,
  StatusPill,
  type StatusTone,
  type TimelineItem,
  type TimelineState,
  PrimaryButton,
  MoreActionsMenu,
  SummaryGrid,
  SummaryCard,
} from "@csa/ui";
import { useOrderStore } from "../hooks/use-orders";
import { formatDate, formatDateTime, formatTime } from "@/lib/format-date";
import type {
  Order,
  OrderState,
  ShipmentState,
  PaymentState,
  OrderReturnItem,
  OrderAddress,
} from "../types/order-types";
import type { CatalogProduct, ShippingMethodOption } from "./order-tab-types";

// ── Tab Sub-Components ───────────────────────────────────────────────
import { OrderGeneralTab } from "./OrderGeneralTab";
import { OrderShippingTab } from "./OrderShippingTab";
import { OrderReturnsTab } from "./OrderReturnsTab";
import { OrderPaymentsTab } from "./OrderPaymentsTab";
import { OrderCommentsTab } from "./OrderCommentsTab";

// ── Helpers ──────────────────────────────────────────────────────────

interface OrderDetailViewProps {
  id: string;
}

type ProductSearchResult = {
  id?: string;
  sku?: string;
  name?: string;
  imageUrl?: string;
  price?: {
    centAmount?: number;
    fractionDigits?: number;
  };
};

function toCatalogProduct(product: ProductSearchResult): CatalogProduct {
  const centAmount = product.price?.centAmount ?? 0;
  const fractionDigits = product.price?.fractionDigits ?? 2;
  return {
    productId: product.id || product.sku || "",
    name: product.name || product.sku || "Unnamed product",
    sku: product.sku || "",
    imageUrl: product.imageUrl,
    unitPrice: centAmount / 10 ** fractionDigits,
  };
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

// ── Main Orchestrator ────────────────────────────────────────────────

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

  const fmtDate = useCallback((v?: string | null, style: "date" | "full" = "full") => {
    return style === "date" ? formatDate(v) : formatDateTime(v);
  }, []);

  // ── Tabs ────────────────────────────────────────────────────────
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

  // ── Shared State ────────────────────────────────────────────────
  const [orderState, setOrderState] = useState<OrderState>(order?.orderState || "Confirmed");
  const [shipmentState, setShipmentState] = useState<ShipmentState>(order?.shipmentState || "Ready");
  const [paymentState, setPaymentState] = useState<PaymentState>(order?.paymentState || "Paid");
  const [stateSaveMsg, setStateSaveMsg] = useState("");
  const [altEmail, setAltEmail] = useState(order?.customerEmail || "");
  const [paymentReminderFeedback, setPaymentReminderFeedback] = useState("");
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState("");
  const [loyaltySavedDollars, setLoyaltySavedDollars] = useState<number | null>(null);
  const [stagedLineQuantities, setStagedLineQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    order?.lineItems.forEach((li) => { initial[li.id] = li.quantity; });
    return initial;
  });
  const [searchCatalogText, setSearchCatalogText] = useState("");
  const [searchCatalogResults, setSearchCatalogResults] = useState<CatalogProduct[]>([]);
  const [searchSelectedQty, setSearchSelectedQty] = useState<Record<string, number>>({});
  const [catalogFeedback, setCatalogFeedback] = useState("");
  const [giftMessageInput, setGiftMessageInput] = useState(order?.giftMessage || "");
  const [giftMsgFeedback, setGiftMsgFeedback] = useState("");
  const [selectedDiscountCode, setSelectedDiscountCode] = useState("");
  const [discountFeedback, setDiscountFeedback] = useState("");
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState(order?.shippingInfo.shippingMethodId || "");
  const [shippingMethodFeedback, setShippingMethodFeedback] = useState("");
  const [shippingMethods, setShippingMethods] = useState<ShippingMethodOption[]>([]);
  const [shippingMethodsError, setShippingMethodsError] = useState("");
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
  const [isReturnDrawerOpen, setIsReturnDrawerOpen] = useState(false);
  const [returnSelectedItems, setReturnSelectedItems] = useState<Record<string, boolean>>({});
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnShipmentState, setReturnShipmentState] = useState<"Returned" | "Advised">("Returned");
  const [returnDateInput, setReturnDateInput] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [returnDrawerError, setReturnDrawerError] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentActionFeedback, setPaymentActionFeedback] = useState("");
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentInput, setCommentInput] = useState("");

  useEffect(() => {
    setOrderState(order.orderState);
    setShipmentState(order.shipmentState);
    setPaymentState(order.paymentState);
    setAltEmail(order.customerEmail || "");
    setGiftMessageInput(order.giftMessage || "");
    setSelectedShippingMethodId(order.shippingInfo.shippingMethodId || "");
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

  useEffect(() => {
    let cancelled = false;

    async function loadShippingMethods() {
      try {
        const response = await fetch("/api/shipping-methods");
        const payload = (await response.json().catch(() => [])) as ShippingMethodOption[] | { error?: string };

        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(Array.isArray(payload) ? "Unable to load shipping methods." : payload.error || "Unable to load shipping methods.");
        }

        if (!cancelled) {
          setShippingMethods(payload);
          setShippingMethodsError("");
        }
      } catch (err) {
        if (!cancelled) {
          setShippingMethods([]);
          setShippingMethodsError(err instanceof Error ? err.message : "Unable to load shipping methods.");
        }
      }
    }

    void loadShippingMethods();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────

  const handleSaveStates = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrderStates(order.id, { orderState, shipmentState, paymentState });
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

  const handleCatalogSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchCatalogText.trim();
    if (!q) { setSearchCatalogResults([]); return; }
    const response = await fetch(`/api/product-search?q=${encodeURIComponent(q)}`);
    const payload = (await response.json().catch(() => ({}))) as { results?: ProductSearchResult[] };
    const results = (payload.results ?? []).map(toCatalogProduct).filter((product) => product.productId);
    setSearchCatalogResults(results);
    const initialQty: Record<string, number> = {};
    results.forEach((r) => { initialQty[r.productId] = 1; });
    setSearchSelectedQty(initialQty);
  };

  const handleAddCatalogItemToOrder = (prod: CatalogProduct) => {
    const qty = searchSelectedQty[prod.productId] || 1;
    addLineItemToOrder(order.id, {
      productId: prod.productId, key: prod.key, name: prod.name,
      sku: prod.sku, imageUrl: prod.imageUrl, unitPrice: prod.unitPrice, quantity: qty,
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
    const method = shippingMethods.find((m) => m.id === selectedShippingMethodId);
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
    order.lineItems.forEach((li) => { initialSelected[li.id] = false; initialQty[li.id] = 1; });
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
          lineItemId: li.id, name: li.name, sku: li.sku, key: li.key,
          imageUrl: li.imageUrl, quantity: qty,
          shipmentState: returnShipmentState, paymentState: "Refunded", comment: returnComment,
        });
      }
    });
    if (returnItemsToSubmit.length === 0) {
      setReturnDrawerError("Please select at least one line item to return.");
      return;
    }
    addReturnToOrder(order.id, returnItemsToSubmit, returnComment,
      returnDateInput ? `${returnDateInput}T09:00:00Z` : undefined, returnShipmentState);
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

  // ── Derived View Data ──────────────────────────────────────────

  const selectedPayment = selectedPaymentId
    ? order.payments.find((p) => p.id === selectedPaymentId)
    : null;

  const returnTrackingDate = returnDateInput.replace(/-/g, "") || "YYYYMMDD";
  const returnTrackingIdPreview = `RTN-${returnTrackingDate}-${order.orderNumber}-${(order.returnInfo?.length || 0) + 1}`;

  const orderTimeline: TimelineItem[] = useMemo(
    () => [
      {
        label: "Order Placed",
        meta: order.createdAt ? fmtDate(order.createdAt, "date") : undefined,
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
        detail: order.shippingInfo.parcels.length > 0
          ? `${order.shippingInfo.parcels.length} parcel(s) dispatched`
          : undefined,
        state: toTimelineState(statusTone(order.shipmentState)),
      },
    ],
    [order.createdAt, order.orderState, order.paymentState, order.shipmentState, order.shippingInfo.parcels.length, fmtDate]
  );

  const backHref = customerIdParam ? `/customers/${customerIdParam}` : isB2b ? "/b2b/orders" : "/orders";
  const backLabel = customerIdParam ? "Go back to customer" : isB2b ? "To order list" : "Back to Orders";

  // ── Render ───────────────────────────────────────────────────────

  return (
    <DetailPage>
      <BackLink href={backHref}>{backLabel}</BackLink>

      <EntityHeader
        title={order?.orderNumber ? `Order #${order.orderNumber}` : "Order Detail"}
        status={<StatusPill tone={statusTone(order.orderState)}>{order.orderState}</StatusPill>}
        meta={`Placed ${order.createdAt ? fmtDate(order.createdAt) : "—"} • ${
          order.store && order.store !== "--" ? order.store : "—"
        }${order.companyName ? ` • ${order.companyName}` : ""}`}
        actions={
          <>
            <MoreActionsMenu
              actions={[
                {
                  id: "view-customer", label: "View Customer", icon: "user",
                  disabled: !order.customerId,
                  onClick: () => order.customerId && router.push(`/customers/${order.customerId}`),
                },
                {
                  id: "create-return", label: "Create Return", icon: "rotate-ccw",
                  onClick: () => { setActiveTab("Returns"); handleOpenReturnDrawer(); },
                },
                {
                  id: "add-comment", label: "Add Comment", icon: "message-square",
                  onClick: () => { setActiveTab("Comments"); setShowCommentForm(true); },
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

      <div className="mt-4">
        <SummaryGrid>
          <SummaryCard
            icon="calendar"
            label="Order Date"
            value={formatDate(order.createdAt)}
            sub={order.createdAt ? formatTime(order.createdAt) : ""}
          />
          <SummaryCard
            icon="hash"
            label="Order Number"
            value={order.orderNumber}
            sub="Standard"
          />
          <SummaryCard
            icon="store"
            label="Sales Channel"
            value={order.store && order.store !== "--" ? order.store : "Web Store"}
            sub="B2C"
          />
          <SummaryCard
            icon="user"
            label="Customer"
            value={order.customerName || "—"}
            sub={order.customerId ? <a href={`/customers/${order.customerId}`} className="text-m-primary hover:underline">View profile →</a> : order.customerEmail || ""}
          />
          <SummaryCard
            icon="dollar-sign"
            label="Total Amount"
            value={`$${(order.grandTotal / 100).toFixed(2)}`}
            sub={`${order.lineItems.length} items`}
          />
          <SummaryCard
            icon="credit-card"
            label="Payment Status"
            value={order.paymentState}
            tone={statusTone(order.paymentState)}
            sub="Credit Card"
          />
        </SummaryGrid>
      </div>

      {/* ── Tab 1: General ── */}
      {activeTab === "General" && (
        <OrderGeneralTab
          order={order} fmtDate={fmtDate}
          orderState={orderState} setOrderState={setOrderState}
          shipmentState={shipmentState} setShipmentState={setShipmentState}
          paymentState={paymentState} setPaymentState={setPaymentState}
          stateSaveMsg={stateSaveMsg} handleSaveStates={handleSaveStates}
          altEmail={altEmail} setAltEmail={setAltEmail}
          paymentReminderFeedback={paymentReminderFeedback} handleSendPaymentReminder={handleSendPaymentReminder}
          loyaltyPointsInput={loyaltyPointsInput} setLoyaltyPointsInput={setLoyaltyPointsInput}
          loyaltySavedDollars={loyaltySavedDollars} handleCalculateLoyalty={handleCalculateLoyalty}
          stagedLineQuantities={stagedLineQuantities} setStagedLineQuantities={setStagedLineQuantities}
          handleUpdateLineItem={handleUpdateLineItem}
          searchCatalogText={searchCatalogText} setSearchCatalogText={setSearchCatalogText}
          searchCatalogResults={searchCatalogResults} handleCatalogSearch={handleCatalogSearch}
          searchSelectedQty={searchSelectedQty} setSearchSelectedQty={setSearchSelectedQty}
          catalogFeedback={catalogFeedback} handleAddCatalogItemToOrder={handleAddCatalogItemToOrder}
          giftMessageInput={giftMessageInput} setGiftMessageInput={setGiftMessageInput}
          giftMsgFeedback={giftMsgFeedback} handleSaveGiftMessage={handleSaveGiftMessage}
          selectedDiscountCode={selectedDiscountCode} setSelectedDiscountCode={setSelectedDiscountCode}
          discountFeedback={discountFeedback} handleApplyDiscountCode={handleApplyDiscountCode}
          orderTimeline={orderTimeline}
          isB2b={isB2b} router={router} setActiveTab={setActiveTab}
          handleDuplicateOrder={handleDuplicateOrder} handleOpenReturnDrawer={handleOpenReturnDrawer}
          setShowCommentForm={setShowCommentForm}
        />
      )}

      {/* ── Tab 2: Shipping & Delivery ── */}
      {activeTab === "Shipping & Delivery" && (
        <OrderShippingTab
          order={order} fmtDate={fmtDate}
          selectedShippingMethodId={selectedShippingMethodId} setSelectedShippingMethodId={setSelectedShippingMethodId}
          shippingMethodFeedback={shippingMethodFeedback} handleSaveShippingMethod={handleSaveShippingMethod}
          shippingMethods={shippingMethods} shippingMethodsError={shippingMethodsError}
          addressForm={addressForm} setAddressForm={setAddressForm}
          addressFeedback={addressFeedback} handleSaveShippingAddress={handleSaveShippingAddress}
          orderTimeline={orderTimeline}
        />
      )}

      {/* ── Tab 3: Returns ── */}
      {activeTab === "Returns" && (
        <OrderReturnsTab
          order={order} fmtDate={fmtDate}
          isReturnDrawerOpen={isReturnDrawerOpen} handleOpenReturnDrawer={handleOpenReturnDrawer}
          setIsReturnDrawerOpen={setIsReturnDrawerOpen}
          returnSelectedItems={returnSelectedItems} setReturnSelectedItems={setReturnSelectedItems}
          returnQuantities={returnQuantities} setReturnQuantities={setReturnQuantities}
          returnShipmentState={returnShipmentState} setReturnShipmentState={setReturnShipmentState}
          returnDateInput={returnDateInput} setReturnDateInput={setReturnDateInput}
          returnComment={returnComment} setReturnComment={setReturnComment}
          returnDrawerError={returnDrawerError} returnTrackingIdPreview={returnTrackingIdPreview}
          handleSubmitReturn={handleSubmitReturn}
        />
      )}

      {/* ── Tab 4: Payments ── */}
      {activeTab === "Payments" && (
        <OrderPaymentsTab
          order={order} fmtDate={fmtDate}
          selectedPaymentId={selectedPaymentId} setSelectedPaymentId={setSelectedPaymentId}
          selectedPayment={selectedPayment} paymentActionFeedback={paymentActionFeedback}
          handleGetLatestPspStatus={handleGetLatestPspStatus} handleSendPaymentLink={handleSendPaymentLink}
        />
      )}

      {/* ── Tab 5: Comments ── */}
      {activeTab === "Comments" && (
        <OrderCommentsTab
          order={order} fmtDate={fmtDate}
          showCommentForm={showCommentForm} setShowCommentForm={setShowCommentForm}
          commentInput={commentInput} setCommentInput={setCommentInput}
          handleAddComment={handleAddComment}
        />
      )}
    </DetailPage>
  );
}
