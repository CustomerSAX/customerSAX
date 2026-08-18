"use client";

import { useRouter } from "next/navigation";
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
} from "@csa/ui";
import {
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
  QuickActions,
  QuickAction,
  CardEmpty,
} from "@/components/detail";
import { formatTime } from "@/lib/format-date";
import type { OrderState, ShipmentState, PaymentState, OrderLineItem } from "../types/order-types";
import type { OrderGeneralTabProps } from "./order-tab-types";

function statusTone(status?: string | null): StatusTone {
  if (!status || status === "--") return "neutral";
  const s = status.toLowerCase();
  if (["paid", "complete", "shipped", "success", "approved", "refunded"].includes(s)) return "success";
  if (["pending", "ready", "initial", "open", "balancedue"].includes(s)) return "warning";
  if (["cancelled", "failed", "returned", "overdue", "declined", "voided"].includes(s)) return "error";
  if (["confirmed", "processing", "delayed", "backorder", "partial"].includes(s)) return "info";
  return "neutral";
}

function ProductThumbnail({ src }: { src?: string }) {
  return (
    <div className="w-10 h-10 rounded-m-md overflow-hidden bg-m-surface-2 border border-m-border flex-shrink-0 flex items-center justify-center">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <Icon name="image" size="sm" className="text-m-text-muted" />
      )}
    </div>
  );
}

const ORDER_STATE_OPTIONS = [
  { value: "Open", label: "Open" }, { value: "Confirmed", label: "Confirmed" },
  { value: "Complete", label: "Complete" }, { value: "Cancelled", label: "Cancelled" },
];
const PAYMENT_STATE_OPTIONS = [
  { value: "BalanceDue", label: "Balance Due" }, { value: "Pending", label: "Pending" },
  { value: "Paid", label: "Paid" }, { value: "Failed", label: "Failed" },
  { value: "CreditOwed", label: "Credit Owed" },
];
const SHIPMENT_STATE_OPTIONS = [
  { value: "Ready", label: "Ready" }, { value: "Partial", label: "Partial" },
  { value: "Shipped", label: "Shipped" }, { value: "Delayed", label: "Delayed" },
  { value: "Backorder", label: "Backorder" },
];

export function OrderGeneralTab(props: OrderGeneralTabProps & {
  isB2b?: boolean;
  router: ReturnType<typeof useRouter>;
  setActiveTab: (tab: string) => void;
  handleDuplicateOrder: () => void;
  handleOpenReturnDrawer: () => void;
  setShowCommentForm: (v: boolean) => void;
}) {
  const {
    order, fmtDate, orderState, setOrderState, shipmentState, setShipmentState,
    paymentState, setPaymentState, stateSaveMsg, handleSaveStates,
    altEmail, setAltEmail, paymentReminderFeedback, handleSendPaymentReminder,
    loyaltyPointsInput, setLoyaltyPointsInput, loyaltySavedDollars, handleCalculateLoyalty,
    stagedLineQuantities, setStagedLineQuantities, handleUpdateLineItem,
    searchCatalogText, setSearchCatalogText, searchCatalogResults,
    handleCatalogSearch, searchSelectedQty, setSearchSelectedQty,
    catalogFeedback, handleAddCatalogItemToOrder,
    giftMessageInput, setGiftMessageInput, giftMsgFeedback, handleSaveGiftMessage,
    selectedDiscountCode, setSelectedDiscountCode, discountFeedback, handleApplyDiscountCode,
    orderTimeline, isB2b, router, setActiveTab, handleDuplicateOrder,
    handleOpenReturnDrawer, setShowCommentForm,
  } = props;

  return (
    <>
          <SummaryGrid>
            <SummaryCard
              icon="calendar"
              label="Order Date"
              value={order.createdAt ? fmtDate(order.createdAt, "date") : "--"}
              sub={order.createdAt ? formatTime(order.createdAt) : undefined}
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
                        <Label>Discount Code</Label>
                        <Input
                          value={selectedDiscountCode}
                          onChange={(e) => setSelectedDiscountCode(e.target.value)}
                          placeholder="Enter discount code..."
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
  );
}
