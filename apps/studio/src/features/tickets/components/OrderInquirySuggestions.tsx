"use client";

import { Sparkles, Check } from "lucide-react";

const suggestions = [
  {
    id: "tracking",
    title: "Where is my order?",
    hint: "Order status & tracking",
    description: (order: string) =>
      `The customer would like an update on ${order}. Please check the current order and shipment status and share tracking information if available. If delivery information is unavailable, identify what needs to be checked next.`
  },
  {
    id: "not-shipped",
    title: "Why hasn’t it shipped?",
    hint: "Payment & fulfillment checks",
    description: (order: string) =>
      `The customer is asking why ${order} has not shipped. Please review the payment and fulfillment information, identify any recorded blockers, and explain the next steps. Flag missing information rather than assuming a reason for the delay.`
  },
  {
    id: "items",
    title: "What did I order?",
    hint: "Items, quantities & totals",
    description: (order: string) =>
      `The customer would like a breakdown of ${order}. Please summarize the ordered items, quantities, prices, discounts, and total using the order details.`
  },
  {
    id: "address",
    title: "Change my shipping address",
    hint: "Address change request",
    description: (order: string) =>
      `The customer would like to change the shipping address for ${order}. Please confirm the complete new shipping address with the customer and check whether the current fulfillment stage allows an address change. Prepare the exact change for agent approval before making any update.`
  },
  {
    id: "cancel",
    title: "Cancel my order",
    hint: "Cancellation eligibility",
    description: (order: string) =>
      `The customer has requested cancellation of ${order}. Please check the order's current status and the applicable cancellation rules. If eligible, prepare a cancellation proposal for agent approval. Explain any payment or refund implications supported by the available data.`
  },
  {
    id: "missing",
    title: "An item is missing",
    hint: "Ordered vs. shipped items",
    description: (order: string) =>
      `The customer reports a missing item from ${order}. Please confirm which item and quantity are missing, compare the ordered quantities with available shipment records, and check for split shipments. Summarize the findings and propose the next investigation step for agent review.`
  }
] as const;

export function orderInquiryDraft(id: string, orderNumber: string) {
  const suggestion = suggestions.find((item) => item.id === id)!;
  return {
    subject: `${suggestion.title}${orderNumber ? ` — ${orderNumber}` : ""}`,
    message: suggestion.description(
      orderNumber ? `order ${orderNumber}` : "the associated order"
    )
  };
}

export function OrderInquirySuggestions({
  selected,
  onSelect,
  disabled
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <section
      aria-labelledby="order-inquiry-suggestions-title"
      className="rounded-xl border border-blue-200 bg-blue-50/50 p-4"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-blue-600" aria-hidden="true" />
        <h3
          id="order-inquiry-suggestions-title"
          className="text-sm font-semibold text-m-text"
        >
          AI inquiry suggestions
        </h3>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-blue-700">
          Quick drafts
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-m-text-muted">
        Choose a request to fill the subject and description. Selecting another replaces
        both fields; you can edit them below.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected === item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-start gap-2 rounded-lg border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 ${selected === item.id ? "border-blue-500 bg-blue-100/60" : "border-m-border bg-m-surface hover:border-blue-300 hover:bg-blue-50"}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-m-text">
                {item.title}
              </span>
              <span className="mt-1 block text-[11px] text-m-text-muted">
                {item.hint}
              </span>
            </span>
            {selected === item.id && (
              <Check
                size={14}
                className="mt-0.5 shrink-0 text-blue-600"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-m-text-muted">
        Drafts help describe the request; selecting one does not execute an order action.
      </p>
      {selected && (
        <p role="status" className="mt-2 text-xs font-medium text-blue-700">
          Subject and description filled. Add any customer-specific details before
          creating the ticket.
        </p>
      )}
    </section>
  );
}
