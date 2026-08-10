"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Panel,
  Modal,
} from "@csa/ui";
import { useOrderStore } from "../orders/hooks/use-orders";
import type {
  OrderState,
  ShipmentState,
  PaymentState,
  OrderLineItem,
  OrderReturnItem,
} from "../orders/types/order-types";

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

export function OrderDetailView({ id }: OrderDetailViewProps) {
  const router = useRouter();
  const {
    orders,
    getOrderById,
    updateOrderStates,
    updateLineItemQuantity,
    addLineItemToOrder,
    addReturnToOrder,
    addOrderComment,
    updateGiftMessage,
  } = useOrderStore();

  const order = getOrderById(id) || orders[0];

  const [activeTab, setActiveTab] = useState<
    "General" | "Shipping" | "Returns" | "Payments" | "Comments"
  >("General");

  // State Management Form
  const [orderState, setOrderState] = useState<OrderState>(order?.orderState || "Confirmed");
  const [shipmentState, setShipmentState] = useState<ShipmentState>(order?.shipmentState || "Ready");
  const [paymentState, setPaymentState] = useState<PaymentState>(order?.paymentState || "Paid");
  const [stateSaveMsg, setStateSaveMsg] = useState("");

  // Product Add Search State
  const [searchSku, setSearchSku] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);

  // Gift Message & Coupon Code State
  const [giftMessageInput, setGiftMessageInput] = useState(order?.giftMessage || "");
  const [giftMsgFeedback, setGiftMsgFeedback] = useState("");
  const [couponCodeInput, setCouponCodeInput] = useState("");

  // Create Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnSelectedItems, setReturnSelectedItems] = useState<Record<string, boolean>>({});
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnStatus, setReturnStatus] = useState<"Returned" | "Advised">("Returned");
  const [returnComment, setReturnComment] = useState("");

  // Comments State
  const [commentInput, setCommentInput] = useState("");

  const handleSaveStates = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrderStates(order.id, {
      orderState,
      shipmentState,
      paymentState,
    });
    setStateSaveMsg("Order fulfillment and payment states updated.");
    setTimeout(() => setStateSaveMsg(""), 3000);
  };

  const handleProductSearch = () => {
    if (!searchSku.trim()) return;
    setSearchResult({
      productId: `prod-new-${Date.now()}`,
      name: "Ergonomic Aluminium Laptop Stand",
      sku: searchSku.toUpperCase().trim(),
      unitPrice: 49.99,
    });
  };

  const handleAddProductToOrder = () => {
    if (!searchResult) return;
    addLineItemToOrder(order.id, {
      productId: searchResult.productId,
      name: searchResult.name,
      sku: searchResult.sku,
      unitPrice: searchResult.unitPrice,
      quantity: 1,
    });
    setSearchResult(null);
    setSearchSku("");
  };

  const handleSaveGiftMessage = () => {
    updateGiftMessage(order.id, giftMessageInput.trim());
    setGiftMsgFeedback("Gift message saved.");
    setTimeout(() => setGiftMsgFeedback(""), 3000);
  };

  const handleOpenReturnModal = () => {
    const initialSelected: Record<string, boolean> = {};
    const initialQty: Record<string, number> = {};
    order.lineItems.forEach((li) => {
      initialSelected[li.id] = false;
      initialQty[li.id] = 1;
    });
    setReturnSelectedItems(initialSelected);
    setReturnQuantities(initialQty);
    setIsReturnModalOpen(true);
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
          imageUrl: li.imageUrl,
          quantity: qty,
          shipmentState: returnStatus,
          paymentState: "Refunded",
          comment: returnComment,
        });
      }
    });

    if (returnItemsToSubmit.length === 0) {
      alert("Please select at least one item to return.");
      return;
    }

    addReturnToOrder(order.id, returnItemsToSubmit, returnComment);
    setIsReturnModalOpen(false);
  };

  const handleAddComment = () => {
    if (!commentInput.trim()) return;
    addOrderComment(order.id, commentInput.trim(), "John Agent");
    setCommentInput("");
  };

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

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to Orders Operations
        </Link>

        <PageHeader
          title={`Order Details: ${order.orderNumber}`}
          subtitle={`Created ${new Date(order.createdAt).toLocaleString()} • Customer: ${order.customerEmail}`}
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
                  alert(`Order ${order.orderNumber} replicated as a new cart.`);
                  router.push(`/cart/cart-new-${order.id}`);
                }}
              >
                Duplicate Order
              </Button>
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} variant="underline">
        <Tabs.List>
          <Tabs.Trigger value="General" icon={<Icon name="shopping-bag" size="xs" />}>General</Tabs.Trigger>
          <Tabs.Trigger value="Shipping" icon={<Icon name="truck" size="xs" />}>
            Shipping & Delivery
          </Tabs.Trigger>
          <Tabs.Trigger value="Returns" icon={<Icon name="rotate-ccw" size="xs" />}>
            Returns ({order.returnInfo?.reduce((acc, r) => acc + r.items.length, 0) || 0})
          </Tabs.Trigger>
          <Tabs.Trigger value="Payments" icon={<Icon name="credit-card" size="xs" />}>
            Payments ({order.payments?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger value="Comments" icon={<Icon name="message-square" size="xs" />}>
            Comments ({order.comments?.length || 0})
          </Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: General */}
        <Tabs.Content value="General" className="space-y-6">
          {/* Line Items Table */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Order Line Items ({order.lineItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead className="text-right">Total Gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lineItems.map((item: OrderLineItem) => (
                    <TableRow key={item.id}>
                      <TableCell className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded border border-m-border" />
                        ) : (
                          <div className="w-12 h-12 bg-m-bg border border-m-border rounded flex items-center justify-center text-xs font-bold text-m-text-muted">
                            IMG
                          </div>
                        )}
                        <span className="font-semibold text-xs text-m-text max-w-xs">{item.name}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-m-text-muted">{item.sku}</TableCell>
                      <TableCell className="text-xs text-m-text">${item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="w-5 h-5 bg-m-bg border border-m-border rounded text-xs font-bold hover:bg-m-border/40"
                            onClick={() => updateLineItemQuantity(order.id, item.id, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            className="w-5 h-5 bg-m-bg border border-m-border rounded text-xs font-bold hover:bg-m-border/40"
                            onClick={() => updateLineItemQuantity(order.id, item.id, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">${item.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-m-text-muted">${item.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-xs font-bold text-m-text text-right">${item.totalGross.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Add Line Item & Promo Codes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Add Product to Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormField>
                      <Label>Search by SKU or Name</Label>
                      <Input
                        value={searchSku}
                        onChange={(e) => setSearchSku(e.target.value)}
                        placeholder="e.g. OFF-CHR-001 or Stand"
                      />
                    </FormField>
                  </div>
                  <Button type="button" variant="secondary" size="md" onClick={handleProductSearch}>
                    Search
                  </Button>
                </div>

                {searchResult && (
                  <div className="p-3 bg-m-bg border border-m-border rounded-md flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-m-text block">{searchResult.name}</span>
                      <span className="text-m-text-muted font-mono">{searchResult.sku} • ${searchResult.unitPrice}</span>
                    </div>
                    <Button type="button" variant="primary" size="sm" onClick={handleAddProductToOrder}>
                      + Add to Order
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Applied Discount Codes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {order.discountCodes && order.discountCodes.length > 0 ? (
                    order.discountCodes.map((code, i) => (
                      <Badge key={i} variant="primary" size="md">
                        🏷️ {code}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-m-text-muted italic">No discount codes applied.</span>
                  )}
                </div>

                <div className="flex items-end gap-2 pt-2">
                  <div className="flex-1">
                    <FormField>
                      <Label>Apply Coupon Code</Label>
                      <Input
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value)}
                        placeholder="Enter code (e.g. WINTER10)"
                      />
                    </FormField>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      if (!couponCodeInput.trim()) return;
                      order.discountCodes.push(couponCodeInput.trim().toUpperCase());
                      setCouponCodeInput("");
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer & Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>
                  <span className="text-m-text-muted block">Name</span>
                  {order.customerId ? (
                    <Link href={`/customers/${order.customerId}`} className="font-bold text-m-primary hover:underline">
                      {order.customerName}
                    </Link>
                  ) : (
                    <span className="font-bold text-m-text">{order.customerName}</span>
                  )}
                </div>
                <div>
                  <span className="text-m-text-muted block">Email</span>
                  <span className="font-medium text-m-text">{order.customerEmail}</span>
                </div>
                <div>
                  <span className="text-m-text-muted block">Company</span>
                  <span className="font-semibold text-m-text">{order.companyName || "--"}</span>
                </div>
                <div>
                  <span className="text-m-text-muted block">Channel / Store</span>
                  <span className="font-medium text-m-text">{order.store}</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-m-text">
                <p className="font-bold">{order.customerName}</p>
                <p>{order.shippingAddress.streetNumber} {order.shippingAddress.streetName}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                <p className="font-semibold text-m-text-muted">{order.shippingAddress.country}</p>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-m-text">
                <p className="font-bold">{order.customerName}</p>
                <p>{order.billingAddress.streetNumber} {order.billingAddress.streetName}</p>
                <p>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}</p>
                <p className="font-semibold text-m-text-muted">{order.billingAddress.country}</p>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary Totals */}
          <Panel className="p-5 bg-m-bg-surface border border-m-border rounded-lg max-w-md ml-auto space-y-2 text-xs">
            <h4 className="text-sm font-bold text-m-text mb-3">Order Summary Totals</h4>
            <div className="flex justify-between">
              <span className="text-m-text-muted">Net Subtotal</span>
              <span className="font-medium text-m-text">${order.netTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-m-text-muted">Tax (8%)</span>
              <span className="font-medium text-m-text">${order.taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-m-text-muted">Shipping Fee</span>
              <span className="font-medium text-m-text">${order.shippingTotal.toFixed(2)}</span>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between text-m-success">
                <span>Discounts</span>
                <span className="font-semibold">-${order.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-m-border text-sm font-bold text-m-text">
              <span>Grand Total (Gross)</span>
              <span className="text-m-primary">${order.grandTotal.toFixed(2)}</span>
            </div>
          </Panel>

          {/* Gift Message & Resend Email */}
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
                  <Input
                    value={giftMessageInput}
                    onChange={(e) => setGiftMessageInput(e.target.value)}
                    placeholder="Enter gift note for recipient..."
                  />
                </FormField>
                <Button type="button" variant="secondary" size="sm" onClick={handleSaveGiftMessage}>
                  Save Gift Message
                </Button>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Customer Order Confirmation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-m-text-muted">
                  Resend formal email invoice and order status updates to <strong>{order.customerEmail}</strong>.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  leftIcon={<Icon name="mail" size="xs" />}
                  onClick={() => alert(`Order confirmation email sent to ${order.customerEmail}`)}
                >
                  Resend Confirmation Email
                </Button>
              </CardContent>
            </Card>
          </div>
        </Tabs.Content>

        {/* Tab 2: Shipping & Delivery */}
        <Tabs.Content value="Shipping" className="space-y-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Fulfillment & Order State Management</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveStates} className="space-y-4">
                {stateSaveMsg && (
                  <div className="p-3 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                    {stateSaveMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField>
                    <Label>Order Status</Label>
                    <Select
                      value={orderState}
                      onChange={(e) => setOrderState(e.target.value as OrderState)}
                      options={ORDER_STATE_OPTIONS}
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

                  <FormField>
                    <Label>Payment Status</Label>
                    <Select
                      value={paymentState}
                      onChange={(e) => setPaymentState(e.target.value as PaymentState)}
                      options={PAYMENT_STATE_OPTIONS}
                    />
                  </FormField>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" size="md">
                    Update Order Fulfillment States
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Shipping Method Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>
                  <span className="text-m-text-muted block">Carrier / Method Name</span>
                  <span className="font-bold text-m-text">{order.shippingInfo.shippingMethodName}</span>
                </div>
                <div>
                  <span className="text-m-text-muted block">Carrier Name</span>
                  <span className="font-semibold text-m-text">{order.shippingInfo.carrier}</span>
                </div>
                <div>
                  <span className="text-m-text-muted block">Shipping Cost</span>
                  <span className="font-medium text-m-text">${order.shippingInfo.price.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-m-text-muted block">Tax Rate</span>
                  <span className="font-medium text-m-text">{order.shippingInfo.taxRate}</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Delivery Parcels & Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                {order.shippingInfo.parcels && order.shippingInfo.parcels.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Tracking Number</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Shipped At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.shippingInfo.parcels.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold text-xs">{p.carrier}</TableCell>
                          <TableCell className="font-mono text-xs text-m-primary font-bold">
                            <a href={`https://www.fedex.com/fedextrack/?trknbr=${p.trackingId}`} target="_blank" rel="noreferrer" className="hover:underline">
                              {p.trackingId}
                            </a>
                          </TableCell>
                          <TableCell>{p.itemsCount} items</TableCell>
                          <TableCell className="text-xs text-m-text-muted">{new Date(p.shippedAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-m-text-muted italic">No delivery parcels created yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </Tabs.Content>

        {/* Tab 3: Returns */}
        <Tabs.Content value="Returns" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-m-text">Order Return History</h3>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="plus" size="xs" />}
              onClick={handleOpenReturnModal}
            >
              Create Order Return
            </Button>
          </div>

          {order.returnInfo && order.returnInfo.length > 0 ? (
            <div className="space-y-4">
              {order.returnInfo.map((ret, idx) => (
                <Card key={idx} variant="default">
                  <CardHeader>
                    <CardTitle className="text-xs font-mono">
                      Return ID: {ret.returnTrackingId} • {new Date(ret.returnDate).toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Returned Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Shipment State</TableHead>
                          <TableHead>Payment State</TableHead>
                          <TableHead>Comment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ret.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-semibold text-xs text-m-text">{item.name}</TableCell>
                            <TableCell className="font-mono text-xs text-m-text-muted">{item.sku}</TableCell>
                            <TableCell className="font-bold">{item.quantity}</TableCell>
                            <TableCell>
                              <Badge variant="warning" size="sm">{item.shipmentState}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="success" size="sm">{item.paymentState}</Badge>
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
                No returns have been processed for this order. Click &quot;Create Order Return&quot; to initiate an RMA.
              </p>
            </Card>
          )}

          {/* Create Return Modal */}
          <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} size="lg">
            <Modal.Header title="Create Order Return (RMA)" onClose={() => setIsReturnModalOpen(false)} />
            <Modal.Body>
              <p className="text-xs text-m-text-muted">
                Select line items and quantities to return for <strong>{order.orderNumber}</strong>.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>Item</TableHead>
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
                      <TableCell className="font-medium text-xs text-m-text">{li.name}</TableCell>
                      <TableCell className="text-xs text-m-text-muted">{li.quantity}</TableCell>
                      <TableCell>
                        <input
                          type="number"
                          min={1}
                          max={li.quantity}
                          value={returnQuantities[li.id] || 1}
                          onChange={(e) =>
                            setReturnQuantities((prev) => ({
                              ...prev,
                              [li.id]: Number(e.target.value),
                            }))
                          }
                          className="w-16 p-1 border border-m-border rounded text-xs text-center"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <FormField>
                <Label>Return Shipment Status</Label>
                <Select
                  value={returnStatus}
                  onChange={(e) => setReturnStatus(e.target.value as any)}
                  options={[
                    { value: "Returned", label: "Returned (Warehouse received)" },
                    { value: "Advised", label: "Advised (RMA issued, pending return)" },
                  ]}
                />
              </FormField>

              <FormField>
                <Label>Return Reason / Comment</Label>
                <textarea
                  className="w-full p-2 border border-m-border rounded text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                  rows={2}
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                  placeholder="Reason for return..."
                />
              </FormField>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="md" onClick={() => setIsReturnModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" onClick={handleSubmitReturn}>
                  Submit Order Return
                </Button>
              </div>
            </Modal.Body>
          </Modal>
        </Tabs.Content>

        {/* Tab 4: Payments */}
        <Tabs.Content value="Payments" className="space-y-6">
          {order.payments && order.payments.length > 0 ? (
            order.payments.map((p) => (
              <Card key={p.id} variant="default" className="space-y-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-mono">
                    Payment ID: {p.id} • Provider: {p.psp} ({p.method})
                  </CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => alert(`Stripe payment status checked: ${p.pspPaymentStatus}`)}
                  >
                    Get Latest PSP Status
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-m-text-muted block">Planned Amount</span>
                      <span className="font-bold text-m-text">${p.amountPlanned.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-m-text-muted block">PSP Status</span>
                      <Badge variant="success" size="sm">{p.pspPaymentStatus}</Badge>
                    </div>
                    <div>
                      <span className="text-m-text-muted block">Interface ID</span>
                      <span className="font-mono text-m-text-muted">{p.interfaceId}</span>
                    </div>
                    <div>
                      <span className="text-m-text-muted block">Created Date</span>
                      <span className="text-m-text-muted">{new Date(p.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-m-border">
                    <h4 className="text-xs font-bold text-m-text mb-2">Payment Transactions Breakdown</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Interaction ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.transactions.map((txn) => (
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card variant="default" className="p-8">
              <p className="text-xs text-m-text-muted text-center italic">
                No payment transactions recorded for this order yet.
              </p>
            </Card>
          )}
        </Tabs.Content>

        {/* Tab 5: Comments */}
        <Tabs.Content value="Comments" className="space-y-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Internal Order Notes & Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <FormField>
                    <Label>Add Order Comment</Label>
                    <textarea
                      className="w-full p-3 border border-m-border rounded-md text-xs text-m-text bg-transparent focus:outline-none focus:ring-1 focus:ring-m-primary"
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add internal order note or customer service update..."
                    />
                  </FormField>
                </div>
                <Button type="button" variant="secondary" size="md" onClick={handleAddComment}>
                  + Add Comment
                </Button>
              </div>

              {order.comments && order.comments.length > 0 ? (
                <div className="space-y-3 pt-2">
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
                <p className="text-xs text-m-text-muted italic">No internal comments logged for this order.</p>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
