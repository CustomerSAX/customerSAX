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
  FormField,
  Label,
} from "@csa/ui";
import { useCartStore } from "../hooks/use-carts";

interface CartPlaceOrderViewProps {
  id: string;
}

export function CartPlaceOrderView({ id }: CartPlaceOrderViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");
  const isB2b = pathname?.startsWith("/b2b");

  const {
    carts,
    getCartById,
    sendPaymentReminder,
    placeOrderFromCart,
  } = useCartStore();

  const cart = getCartById(id) || carts[0];

  const [altEmail, setAltEmail] = useState(cart.customerEmail || "");
  const [reminderFeedback, setReminderFeedback] = useState("");

  const [placing, setPlacing] = useState(false);
  const [orderCreatedId, setOrderCreatedId] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const handleSendPaymentReminder = () => {
    if (!altEmail.trim()) return;
    sendPaymentReminder(cart.id, altEmail.trim());
    setReminderFeedback(`Payment reminder notification email sent to ${altEmail.trim()}. You are good to place the order now.`);
    setTimeout(() => setReminderFeedback(""), 4500);
  };

  const handlePlaceOrder = () => {
    setPlacing(true);
    setTimeout(() => {
      const newOrderId = placeOrderFromCart(cart.id);
      setOrderCreatedId(newOrderId);
      setPlacing(false);
      setIsSuccessModalOpen(true);
    }, 600);
  };

  const prefix = isB2b ? "/b2b" : "";
  const backToAddressesHref = `${prefix}/cart/${cart.id}/address-details${customerIdParam ? `?customerId=${customerIdParam}` : ""}`;
  const backToCartHref = customerIdParam
    ? `/customers/${customerIdParam}`
    : `${prefix}/cart`;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <Link
          href={backToAddressesHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to addresses
        </Link>

        <PageHeader
          title="Place order"
          subtitle="Confirm cart totals and customer shipping details before creating the order."
          actions={
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push(backToAddressesHref)}
            >
              ← Back to addresses
            </Button>
          }
        />
      </div>

      {/* Send Payment Reminder Panel */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Send Payment Reminder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-m-text-muted">
            Send an email payment notification directly to the customer&apos;s registered email address.
          </p>
          {reminderFeedback && (
            <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
              {reminderFeedback}
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <FormField>
                <Label>Customer Email</Label>
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

      {/* Place Order Summary Grid */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Place Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Cart Total</span>
              <span className="text-base font-extrabold text-m-primary font-mono">${cart.grandTotal.toFixed(2)}</span>
            </div>

            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Line Items</span>
              <span className="text-base font-bold text-m-text">
                {cart.lineItems.length} Items ({cart.lineItems.reduce((acc, i) => acc + i.quantity, 0)} Units)
              </span>
            </div>

            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Customer Email</span>
              {cart.customerId ? (
                <Link
                  href={`/customers/${cart.customerId}`}
                  className="font-bold text-m-primary hover:underline"
                >
                  {cart.customerEmail}
                </Link>
              ) : (
                <span className="font-semibold text-m-text">{cart.customerEmail}</span>
              )}
            </div>

            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Fulfillment Destination</span>
              <span className="font-semibold text-m-text">
                {cart.shippingAddress
                  ? `${cart.shippingAddress.city}, ${cart.shippingAddress.country}`
                  : "Not set"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!cart.shippingAddress && (
        <div className="p-4 bg-m-error-surface text-m-error text-xs font-semibold rounded-md">
          ⚠️ A shipping address is required before placing an order. Go back to address step and configure shipping destination first.
        </div>
      )}

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-m-border shadow-lg flex items-center justify-between z-40 px-8">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" onClick={() => router.push(backToCartHref)}>
            Cancel
          </Button>
          <Button variant="secondary" size="md" onClick={() => router.back()}>
            Back
          </Button>
        </div>
        <Button
          variant="primary"
          size="md"
          disabled={placing || !cart.shippingAddress || cart.cartState === "Ordered"}
          onClick={handlePlaceOrder}
        >
          {placing ? "Placing Order..." : "Place Order"}
        </Button>
      </div>

      {/* Order Placement Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <h3 className="text-lg font-bold text-m-text">Order placed successfully!</h3>
            <p className="text-xs text-m-text-muted">
              The order has been created from this cart (Order ID: <span className="font-mono font-bold text-m-text">{orderCreatedId}</span>).
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push(backToCartHref)}
              >
                Back to cart
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => router.push(`${prefix}/orders/${orderCreatedId || cart.id}`)}
              >
                View order →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
