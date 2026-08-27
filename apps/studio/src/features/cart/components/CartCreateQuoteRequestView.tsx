"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Icon,
  Label,
  PageHeader,
} from "@csa/ui";
import { useCartStore } from "../hooks/use-carts";

interface CartCreateQuoteRequestViewProps {
  id: string;
}

function formatCartTotal(cart: { currencyCode?: string; grandTotal: number }) {
  return `${cart.grandTotal.toFixed(2)} ${cart.currencyCode || "USD"}`;
}

export function CartCreateQuoteRequestView({ id }: CartCreateQuoteRequestViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");

  const { loading, error, getCartById } = useCartStore();
  const cart = getCartById(id);

  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!cart) {
    return (
      <div className="space-y-6 pb-20">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to carts
        </Link>
        <Card variant="default">
          <CardContent className="p-8 text-center space-y-2">
            <div className="font-bold text-sm text-m-text">{loading ? "Loading cart" : "Cart not found"}</div>
            <p className="text-xs text-m-text-muted">
              {error || (loading ? "Fetching cart data from the commerce backend." : "No cart matched this ID.")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backToAddressesHref = `/cart/${cart.id}/address-details-for-quotes${
    customerIdParam ? `?customerId=${customerIdParam}` : ""
  }`;
  const backToCartHref = `/cart/${cart.id}${customerIdParam ? `?customerId=${customerIdParam}` : ""}`;
  const customerHref = cart.customerId ? `/customers/${cart.customerId}?tab=quotes` : "/cart";
  const hasShippingAddress = Boolean(cart.shippingAddress);
  const hasLineItems = cart.lineItems.length > 0;

  const handleSubmitQuoteRequest = async () => {
    if (!hasShippingAddress || !hasLineItems) return;
    setSubmitting(true);
    setFeedback("");

    try {
      const response = await fetch("/api/quotes/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: cart.id,
          comment: comment.trim() || undefined
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; id?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit quote request.");
      }

      setFeedback(`Quote request ${payload.id || ""} submitted successfully.`);
      router.push(customerHref);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to submit quote request.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <Link
          href={backToAddressesHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to addresses
        </Link>

        <PageHeader
          title="Request for Quote"
          subtitle="Review cart totals and submit the quote request for sales follow-up."
          actions={
            <Button variant="secondary" size="md" onClick={() => router.push(backToAddressesHref)}>
              ← Back to addresses
            </Button>
          }
        />
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Quote Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Cart Total</span>
              <span className="text-base font-extrabold text-m-primary font-mono">{formatCartTotal(cart)}</span>
            </div>
            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Line Items</span>
              <span className="text-base font-bold text-m-text">{cart.lineItems.length} Items</span>
            </div>
            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Customer Email</span>
              <span className="font-semibold text-m-text">{cart.customerEmail || "--"}</span>
            </div>
            <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
              <span className="text-m-text-muted font-semibold">Fulfillment Destination</span>
              <span className="font-semibold text-m-text">
                {cart.shippingAddress ? `${cart.shippingAddress.city}, ${cart.shippingAddress.country}` : "Not set"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Quote Notes & Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField>
            <Label>Sales Note / Comment</Label>
            <p className="text-xs text-m-text-muted">Add a note for the sales team reviewing this quote request.</p>
            <textarea
              className="w-full min-h-20 rounded-m-md border border-m-border bg-transparent p-3 text-xs text-m-text focus:outline-none focus:ring-1 focus:ring-m-primary"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </FormField>
          {feedback && (
            <div className="rounded-md border border-m-border bg-m-surface-2 px-3 py-2 text-xs font-semibold text-m-text">
              {feedback}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasShippingAddress && (
        <div className="p-4 bg-m-error-surface text-m-error text-xs font-semibold rounded-md">
          A shipping address is required before requesting a quote. Go back to the address step and configure a shipping destination first.
        </div>
      )}

      {!hasLineItems && (
        <div className="p-4 bg-m-error-surface text-m-error text-xs font-semibold rounded-md">
          At least one line item is required before requesting a quote.
        </div>
      )}

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
          disabled={submitting || !hasShippingAddress || !hasLineItems}
          onClick={handleSubmitQuoteRequest}
        >
          {submitting ? "Submitting..." : "Submit Quote Request"}
        </Button>
      </div>
    </div>
  );
}
