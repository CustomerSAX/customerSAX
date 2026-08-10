"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Icon,
  Input,
  Select,
  FormField,
  Label,
  Badge,
  Tabs,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Drawer,
} from "@csa/ui";
import { useOrderStore, MOCK_SHIPPING_METHODS, MOCK_CATALOG_PRODUCTS, MOCK_AVAILABLE_DISCOUNTS } from "../hooks/use-orders";
import type {
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

function ProductThumbnail({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-12 h-12 bg-m-bg border border-m-border rounded flex items-center justify-center text-[10px] font-bold text-m-text-muted shrink-0">
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

  const order = getOrderById(id) || orders[0];

  const B2C_TABS = ["General", "Shipping & Delivery", "Returns", "Payments", "Comments"] as const;
  const B2B_TABS = ["General", "Custom Attributes", "Shipping & Delivery", "Returns", "Payments"] as const;
  const tabs = isB2b ? B2B_TABS : B2C_TABS;

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

  // ── Render Helpers ──────────────────────────────────────────────────────

  const renderOrderStateBadge = (s: OrderState) => {
    switch (s) {
      case "Open":
        return <Badge variant="primary" size="sm" dot>Open</Badge>;
      case "Confirmed":
        return <Badge variant="warning" size="sm">Confirmed</Badge>;
      case "Complete":
        return <Badge variant="success" size="sm">Complete</Badge>;
      case "Cancelled":
        return <Badge variant="error" size="sm">Cancelled</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{s}</Badge>;
    }
  };

  const renderShipmentBadge = (s: ShipmentState) => {
    switch (s) {
      case "Shipped":
        return <Badge variant="success" size="sm">Shipped</Badge>;
      case "Ready":
        return <Badge variant="info" size="sm">Ready</Badge>;
      case "Pending":
        return <Badge variant="warning" size="sm">Pending</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{s}</Badge>;
    }
  };

  const renderPaymentBadge = (s: PaymentState) => {
    switch (s) {
      case "Paid":
        return <Badge variant="success" size="sm">Paid</Badge>;
      case "Pending":
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case "BalanceDue":
        return <Badge variant="error" size="sm">Balance Due</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{s}</Badge>;
    }
  };

  const selectedPayment = selectedPaymentId
    ? order.payments.find((p) => p.id === selectedPaymentId)
    : null;

  const returnTrackingIdPreview = `RTN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${order.orderNumber}-${(order.returnInfo?.length || 0) + 1}`;

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div>
        <Link
          href={customerIdParam ? `/customers/${customerIdParam}` : (isB2b ? "/b2b/orders" : "/orders")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          {customerIdParam ? "Go back to customer" : (isB2b ? "To order list" : "Back to Orders")}
        </Link>

        <PageHeader
          title={order?.orderNumber ? `Order #${order.orderNumber}` : "Order Detail"}
          subtitle={`Inspect order fulfillment, payment state, line items, and shipping progress. Created ${new Date(order.createdAt).toLocaleString()}`}
          badge={renderOrderStateBadge(order.orderState)}
          actions={
            <div className="flex items-center gap-2">
              {renderShipmentBadge(order.shipmentState)}
              {renderPaymentBadge(order.paymentState)}
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Icon name="copy" size="xs" />}
                onClick={() => {
                  const cartId = duplicateOrder(order.id);
                  router.push(`/cart/${cartId}`);
                }}
              >
                {isB2b ? "Copy Order" : "Duplicate Order"}
              </Button>
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)} variant="underline">
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Trigger key={t} value={t}>
              {t}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ── Tab 1: General ── */}
        <Tabs.Content value="General" className="space-y-6">
          {/* Send Payment Notification Panel (B2C) */}
          {!isB2b && (
            <Card variant="default">
              <CardHeader>
                <CardTitle>Send Payment Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-m-text-muted">
                  Send an automated payment link reminder to the customer&apos;s registered email address.
                </p>
                {paymentReminderFeedback && (
                  <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
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
              </CardContent>
            </Card>
          )}

          {/* Grid: Order Summary + Financial Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Order Summary Panel */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveStates} className="space-y-4">
                  {stateSaveMsg && (
                    <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                      {stateSaveMsg}
                    </div>
                  )}

                  <FormField>
                    <Label>Order Number</Label>
                    <Input value={order.orderNumber} readOnly className="bg-m-bg" />
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
              </CardContent>
            </Card>

            {/* Order Financial Breakdown Panel */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Order Financial Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col justify-between h-full space-y-4">
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
              </CardContent>
            </Card>
          </div>

          {/* Redeem Loyalty Points (B2C) */}
          {!isB2b && (
            <Card variant="default">
              <CardHeader>
                <CardTitle>Redeem Loyalty Points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                      <div className="px-3 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-md border border-emerald-200 text-xs">
                        Amount Saved: ${loyaltySavedDollars.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer & Addresses */}
          <Card variant="default">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{isB2b ? "Customer Details" : "Customer & Addresses"}</CardTitle>
              {order.customerId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/customers/${order.customerId}`)}
                >
                  View Customer Profile →
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-m-bg rounded-lg border border-m-border flex items-center gap-2 text-xs">
                <Icon name="mail" size="xs" />
                <span className="font-semibold text-m-text">Customer email:</span>
                <span className="font-bold text-m-primary">{order.customerEmail}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-lg border border-m-border bg-white space-y-2 text-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-m-border text-m-primary font-bold">
                    <Icon name="home" size="xs" />
                    <span>Shipping Address</span>
                  </div>
                  <p className="font-bold text-m-text">{order.customerName}</p>
                  <p className="text-m-text">
                    {order.shippingAddress.streetNumber} {order.shippingAddress.streetName} {order.shippingAddress.building}
                  </p>
                  <p className="text-m-text">
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                  </p>
                  <p className="font-semibold text-m-text-muted">{order.shippingAddress.country}</p>
                </div>

                <div className="p-4 rounded-lg border border-m-border bg-white space-y-2 text-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-m-border text-m-primary font-bold">
                    <Icon name="file-text" size="xs" />
                    <span>Billing Address</span>
                  </div>
                  <p className="font-bold text-m-text">{order.customerName}</p>
                  <p className="text-m-text">
                    {order.billingAddress.streetNumber} {order.billingAddress.streetName} {order.billingAddress.building}
                  </p>
                  <p className="text-m-text">
                    {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}
                  </p>
                  <p className="font-semibold text-m-text-muted">{order.billingAddress.country}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items Table */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Order Items ({order.lineItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Add Line Items Panel */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Add Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {catalogFeedback && (
                <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
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
            </CardContent>
          </Card>

          {/* Gift Message & Discount Codes (B2C) */}
          {!isB2b && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card variant="default">
                <CardHeader>
                  <CardTitle>Gift Message</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {giftMsgFeedback && (
                    <div className="p-2 bg-m-success-surface text-m-success text-xs font-semibold rounded">
                      {giftMsgFeedback}
                    </div>
                  )}
                  <FormField>
                    <textarea
                      className="w-full p-2.5 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                      rows={3}
                      value={giftMessageInput}
                      onChange={(e) => setGiftMessageInput(e.target.value)}
                      placeholder="Enter special gift note for recipient..."
                    />
                  </FormField>
                  <Button type="button" variant="primary" size="sm" onClick={handleSaveGiftMessage}>
                    Save Gift Message
                  </Button>
                </CardContent>
              </Card>

              <Card variant="default">
                <CardHeader>
                  <CardTitle>Add Discount Codes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {discountFeedback && (
                    <div className="p-2 bg-m-success-surface text-m-success text-xs font-semibold rounded">
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
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                        Applied Discounts
                      </span>
                      {order.appliedDiscounts.map((row) => (
                        <div key={row.code} className="text-xs font-semibold text-m-text">
                          🏷️ {row.code} {row.name ? `— ${row.name}` : ""} ({row.savings} saved)
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ineffective discounts */}
                  {order.ineffectiveDiscounts && order.ineffectiveDiscounts.length > 0 && (
                    <div className="pt-3 border-t border-m-border space-y-1">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                        Not Applied
                      </span>
                      {order.ineffectiveDiscounts.map((row) => (
                        <div key={row.code} className="text-xs text-m-text-muted">
                          <span className="font-bold text-m-text">{row.code}:</span> {row.message}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </Tabs.Content>

        {/* ── Tab 2: Custom Attributes (B2B) ── */}
        {isB2b && (
          <Tabs.Content value="Custom Attributes" className="space-y-6">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Order Custom Fields & Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.customFields && order.customFields.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {order.customFields.map((field) => (
                      <div key={field.name} className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-m-text-muted uppercase tracking-wider">{field.name}</span>
                        <span className="text-xs font-semibold text-m-text">{String(field.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-m-text-muted italic">There are no custom fields attached to this order.</p>
                )}
              </CardContent>
            </Card>
          </Tabs.Content>
        )}

        {/* ── Tab 3: Shipping & Delivery ── */}
        <Tabs.Content value="Shipping & Delivery" className="space-y-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Shipping Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shippingMethodFeedback && (
                <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
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
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <CardTitle>Shipping Details & Address</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveShippingAddress} className="space-y-4">
                {addressFeedback && (
                  <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                    {addressFeedback}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField>
                    <Label>Shipped Quantity</Label>
                    <Input
                      value={String(order.lineItems.reduce((acc, li) => acc + li.quantity, 0))}
                      readOnly
                      className="bg-m-bg"
                    />
                  </FormField>
                  <FormField>
                    <Label>Shipping Tax</Label>
                    <Input value={`$${(order.shippingInfo.price * 0.08).toFixed(2)}`} readOnly className="bg-m-bg" />
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
            </CardContent>
          </Card>

          {order.shippingInfo.parcels && order.shippingInfo.parcels.length > 0 && (
            <Card variant="default">
              <CardHeader>
                <CardTitle>Deliveries ({order.shippingInfo.parcels.length})</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-m-border text-xs">
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
              </CardContent>
            </Card>
          )}
        </Tabs.Content>

        {/* ── Tab 4: Returns ── */}
        <Tabs.Content value="Returns" className="space-y-6">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={handleOpenReturnDrawer}
            >
              + Create Order Return
            </Button>
          </div>

          {/* Existing Returns List */}
          {order.returnInfo && order.returnInfo.length > 0 ? (
            <div className="space-y-4">
              {order.returnInfo.map((ret, idx) => (
                <Card key={ret.returnTrackingId || idx} variant="default">
                  <CardHeader>
                    <CardTitle className="text-xs font-mono">
                      Return Request #{idx + 1} • Tracking ID: {ret.returnTrackingId} • Date: {new Date(ret.returnDate).toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                              <Badge variant="warning" size="sm">{item.shipmentState}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="success" size="sm">{item.paymentState}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-m-text-muted">
                              {new Date(item.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs text-m-text-muted">{item.comment || "--"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card variant="default" className="p-8">
              <p className="text-xs text-m-text-muted text-center italic">
                No return records recorded for this order. Click &quot;Create Order Return&quot; to initiate an RMA.
              </p>
            </Card>
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
                <div className="p-2.5 bg-m-error-surface text-m-error text-xs font-semibold rounded-md">
                  {returnDrawerError}
                </div>
              )}

              <FormField>
                <Label>Return Tracking Id</Label>
                <Input value={returnTrackingIdPreview} readOnly className="bg-m-bg font-mono text-xs" />
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
                  className="w-full p-2.5 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
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
        </Tabs.Content>

        {/* ── Tab 5: Payments ── */}
        <Tabs.Content value="Payments" className="space-y-6">
          {paymentActionFeedback && (
            <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
              {paymentActionFeedback}
            </div>
          )}

          <Card variant="default">
            <CardHeader>
              <CardTitle>Payment Transactions</CardTitle>
            </CardHeader>
            <CardContent>
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
                <p className="text-xs text-m-text-muted italic">There are no payment records associated with this order.</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Detail Panel (Expandable) */}
          {selectedPayment && (
            <Card variant="default" className="border-l-4 border-l-m-primary">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-mono">Payment ID: {selectedPayment.id}</CardTitle>
                  <span className="text-[11px] text-m-text-muted">
                    Created: {new Date(selectedPayment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedPaymentId(null)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGetLatestPspStatus(selectedPayment.id)}
                  >
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
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <Badge variant="success" size="sm">{selectedPayment.pspPaymentStatus}</Badge>
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
                            <Badge variant="success" size="sm">{txn.state}</Badge>
                          </TableCell>
                          <TableCell className="font-bold text-xs">${txn.amount.toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs text-m-text-muted">{txn.interactionId}</TableCell>
                          <TableCell className="font-mono text-xs text-m-text-muted">{txn.id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </Tabs.Content>

        {/* ── Tab 6: Comments ── */}
        <Tabs.Content value="Comments" className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={() => setShowCommentForm(!showCommentForm)}
            >
              {showCommentForm ? "Cancel Comment" : "+ Add Comment"}
            </Button>
          </div>

          {showCommentForm && (
            <Card variant="default">
              <CardHeader>
                <CardTitle>Add New Order Comment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField>
                  <textarea
                    className="w-full p-3 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
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
              </CardContent>
            </Card>
          )}

          <Card variant="default">
            <CardHeader>
              <CardTitle>Order Notes & History ({order.comments?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {order.comments && order.comments.length > 0 ? (
                <div className="space-y-3">
                  {order.comments.map((c) => (
                    <div key={c.id} className="p-3 bg-m-bg border border-m-border rounded-md text-xs space-y-1">
                      <div className="flex items-center justify-between text-m-text-muted">
                        <span className="font-bold text-m-text">{c.author}</span>
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-m-text leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-m-text-muted italic">There are no comments attached to this order yet.</p>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
