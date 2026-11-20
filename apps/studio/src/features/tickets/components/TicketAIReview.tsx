"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { Ticket } from "../types/ticket-types";

type Review = {
  informationRequest?: {
    status: string;
    recipient: string;
    subject: string;
    text: string;
    createdAt: string;
  } | null;
  informationRequestError?: string;
  informationQuestions?: string[];
  revision: string;
  status:
    | "analyzing"
    | "pending"
    | "blocked"
    | "executing"
    | "succeeded"
    | "closing"
    | "closed"
    | "kept_open"
    | "close_stale"
    | "close_uncertain"
    | "declined"
    | "stale"
    | "failed"
    | "uncertain";
  summary: string;
  explanation: string;
  agentAssist?: {
    queryAnswers: Array<{
      query: string;
      answer: string;
      status: "answered" | "needs_verification" | "needs_information";
    }>;
    actions: string[];
    responseDraft: string;
    missingInformation: string[];
  };
  action: {
    customerEmail: string;
    addressId: string;
    addressLabel: string;
    previousPhone: string;
    phone: string;
  } | null;
  targets: Array<{ id: string; label: string; phone: string }>;
  orderProposal?: {
    orderNumber: string;
    previousAddress?: Record<string, unknown>;
    queryAnswers?: Array<{
      query: string;
      answer: string;
      status: "answered" | "needs_verification" | "needs_information";
    }>;
    actions: string[];
    responseDraft: string;
    missingInformation: string[];
  };
  orderAction?:
    | { kind: "cancel_order" }
    | { kind: "change_shipping_address"; address: Record<string, string> }
    | {
        kind: "start_return";
        reason: string;
        lineItems: Array<{
          lineItemId: string;
          quantity: number;
          name: string;
          sku?: string;
        }>;
      };
  orderResult?: { id: string; version: number; returnTrackingId?: string };
  findingsApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  closeApprovedBy?: string;
  closeApprovedAt?: string;
  resolutionDraft?: string;
  resolutionNotes?: string;
  result?: { version: number; phone: string };
};
const labels: Record<Review["status"], string> = {
  analyzing: "Analyzing ticket",
  pending: "Awaiting approval",
  blocked: "Needs review",
  executing: "Executing approved action",
  succeeded: "Review completed",
  closing: "Closing ticket",
  closed: "Ticket closed",
  kept_open: "Ticket kept open",
  close_stale: "Review ticket before closing",
  close_uncertain: "Check ticket status",
  declined: "Declined",
  stale: "Proposal out of date",
  failed: "Analysis unavailable",
  uncertain: "Check CT outcome"
};

export function TicketAIReview({
  ticket,
  onTicketChanged,
  initialOperation = "analyze"
}: {
  ticket: Ticket;
  onTicketChanged: () => Promise<unknown>;
  initialOperation?: "load" | "analyze";
}) {
  const zendesk = ticket.id.startsWith("zendesk:");
  const completionVerb = zendesk ? "resolve" : "close";
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addressId, setAddressId] = useState("");
  const [editedResolution, setEditedResolution] = useState<string | null>(null);
  const resolutionNotes =
    editedResolution ??
    [ticket.solution, review?.resolutionDraft].filter(Boolean).join("\n\n");
  const refreshedEmail = useRef("");
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const request = useCallback(
    async (operation: string, options: Record<string, unknown> = {}) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/tickets/ai-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ operation, ticketId: ticket.id, ...options })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load the proposal.");
        if (mounted.current) setReview(data.review);
        const emailId = data.review?.informationRequest?.createdAt;
        const emailChanged =
          data.review?.informationRequest?.status === "accepted" &&
          emailId !== refreshedEmail.current;
        if (
          (data.review?.status === "closed" &&
            !["Closed", "Resolved"].includes(ticket.status)) ||
          emailChanged ||
          operation !== "load"
        ) {
          if (emailChanged) refreshedEmail.current = emailId;
          await onTicketChanged();
        }
      } catch (cause) {
        if (mounted.current)
          setError(
            cause instanceof Error ? cause.message : "Unable to load the proposal."
          );
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [ticket.id, ticket.status, onTicketChanged]
  );

  useEffect(() => {
    mounted.current = true;
    // Defer the initial request so Strict Mode's discarded mount cannot start work.
    const timer = window.setTimeout(() => {
      void request(initialOperation);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      mounted.current = false;
    };
  }, [request, initialOperation]);

  useEffect(() => {
    if (
      busy ||
      error ||
      !review ||
      !["analyzing", "executing", "closing"].includes(review.status)
    )
      return;
    const timer = window.setTimeout(() => {
      void request("load");
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [busy, error, review, request]);

  const running =
    busy ||
    review?.status === "analyzing" ||
    review?.status === "executing" ||
    review?.status === "closing";
  const action = review?.action;
  const refreshable =
    !running &&
    !review?.result &&
    !review?.orderResult &&
    !review?.findingsApproved &&
    review?.status !== "succeeded" &&
    review?.status !== "uncertain";

  return (
    <section
      aria-labelledby="ticket-ai-review-title"
      className="overflow-hidden rounded-2xl border border-blue-200 bg-m-surface shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-m-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Sparkles size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id="ticket-ai-review-title" className="text-sm font-semibold text-m-text">
              AI summary & actions
            </h2>
            <p className="mt-0.5 text-xs text-m-text-muted">
              Review every customer query, suggested actions, and reply draft
            </p>
          </div>
        </div>
        <span
          role="status"
          className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700"
        >
          {running && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {review
            ? zendesk && review.status === "closed"
              ? "Ticket resolved"
              : labels[review.status]
            : busy
              ? initialOperation === "load"
                ? "Loading review"
                : "Analyzing ticket"
              : "Not analyzed"}
        </span>
      </header>
      <div className="space-y-5 p-5">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void request("analyze");
              }}
              className="ml-2 font-semibold underline"
            >
              Reload status
            </button>
          </div>
        )}
        {!review && busy && (
          <p className="text-sm text-m-text-muted">
            Reading the ticket and preparing a proposal. No customer changes are being
            made.
          </p>
        )}
        {review?.summary && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
              Request summary
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-m-text">
              {review.summary}
            </p>
          </div>
        )}
        <blockquote className="whitespace-pre-wrap break-words border-l-2 border-blue-200 pl-3 text-xs leading-relaxed text-m-text-muted">
          {ticket.message || "No customer message provided."}
        </blockquote>

        {review?.agentAssist && (
          <div className="space-y-4 rounded-xl border border-m-border p-4">
            <div>
              <h3 className="text-sm font-semibold">Customer queries & guidance</h3>
              <div className="mt-3 space-y-3">
                {review.agentAssist.queryAnswers.map((item, index) => (
                  <div key={index} className="rounded-lg bg-m-surface-2 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-m-text">{item.query}</p>
                      <span className="rounded-full border border-m-border bg-m-surface px-2 py-0.5 text-[10px] font-semibold text-m-text-muted">
                        {item.status === "answered"
                          ? "Answered"
                          : item.status === "needs_information"
                            ? "Customer detail needed"
                            : "Verify before replying"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed text-m-text">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {!!review.agentAssist.actions.length && (
              <div>
                <h4 className="text-xs font-semibold">Suggested agent actions</h4>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {review.agentAssist.actions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ol>
              </div>
            )}
            {!!review.agentAssist.missingInformation.length && (
              <div>
                <h4 className="text-xs font-semibold">Information to request</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {review.agentAssist.missingInformation.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold">
                Customer response draft · Not sent
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {review.agentAssist.responseDraft}
              </p>
            </div>
          </div>
        )}

        {review?.orderProposal && (
          <div className="space-y-4 rounded-xl border border-m-border p-4">
            <h3 className="text-sm font-semibold">
              Order {review.orderProposal.orderNumber} · Suggested actions
            </h3>
            {!!review.orderProposal.queryAnswers?.length && (
              <div className="space-y-3">
                {review.orderProposal.queryAnswers.map((item, index) => (
                  <div key={index} className="rounded-lg bg-m-surface-2 p-3 text-sm">
                    <p className="font-semibold">{item.query}</p>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {review.orderProposal.actions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
            {!!review.orderProposal.missingInformation.length && (
              <div>
                <h4 className="text-xs font-semibold">Information to confirm</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {review.orderProposal.missingInformation.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold">
                Customer response draft · Not sent
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {review.orderProposal.responseDraft}
              </p>
            </div>
            {review.orderAction && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                <h4 className="font-semibold">
                  {review.orderResult
                    ? "Confirmed order change"
                    : "Order change requiring approval"}
                </h4>
                {review.orderAction.kind === "cancel_order" ? (
                  <p className="mt-2">
                    Set order status to Cancelled. No refund or customer message is
                    included.
                  </p>
                ) : review.orderAction.kind === "start_return" ? (
                  <div className="mt-2 space-y-2">
                    <p>
                      Record the following merchandise return. This does not issue a
                      refund or send a customer message.
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      {review.orderAction.lineItems.map((item) => (
                        <li key={item.lineItemId}>
                          {item.quantity} × {item.name}
                          {item.sku ? ` · ${item.sku}` : ""}
                        </li>
                      ))}
                    </ul>
                    <p>
                      <span className="font-medium">Customer’s reason:</span>{" "}
                      {review.orderAction.reason}
                    </p>
                    {review.orderResult?.returnTrackingId && (
                      <p>
                        <span className="font-medium">Return tracking:</span>{" "}
                        {review.orderResult.returnTrackingId}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="mt-2">
                      Current address:{" "}
                      {[
                        "streetNumber",
                        "streetName",
                        "city",
                        "state",
                        "postalCode",
                        "country"
                      ]
                        .map((key) => review.orderProposal?.previousAddress?.[key])
                        .filter(Boolean)
                        .join(", ") || "Not recorded"}
                    </p>
                    <p className="mt-2">Update shipping address fields:</p>
                    <dl className="mt-2 space-y-1">
                      {Object.entries(review.orderAction.address ?? {}).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt className="inline font-medium">{key}: </dt>
                            <dd className="inline">{value || "Clear field"}</dd>
                          </div>
                        )
                      )}
                    </dl>
                    <p className="mt-2">
                      Recipient and contact details are preserved. Tax and shipping totals
                      are unchanged.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {action && (
          <div className="overflow-hidden rounded-xl border border-m-border">
            <h3 className="flex items-center gap-2 border-b border-m-border bg-m-surface-2 px-4 py-3 text-sm font-semibold text-m-text">
              <Phone size={15} className="text-blue-600" aria-hidden="true" />
              Update contact number in commercetools
            </h3>
            <div className="space-y-4 p-4">
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-m-text-muted">Customer</dt>
                  <dd className="mt-1 break-all font-medium text-m-text">
                    {action.customerEmail}
                  </dd>
                </div>
                <div>
                  <dt className="text-m-text-muted">Customer address · phone field</dt>
                  <dd className="mt-1 font-medium text-m-text">{action.addressLabel}</dd>
                  <dd className="mt-1 break-all text-[10px] text-m-text-muted">
                    ID: {action.addressId}
                  </dd>
                </div>
              </dl>
              <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-lg bg-m-surface-2 p-3">
                  <p className="text-[11px] text-m-text-muted">
                    {review?.result ? "Previous number" : "Current number"}
                  </p>
                  <p className="mt-2 break-all text-sm text-m-text">
                    {action.previousPhone || "Not set"}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="hidden text-m-text-muted sm:block"
                  aria-hidden="true"
                />
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="text-[11px] text-blue-800">
                    {review?.result ? "Updated number" : "Proposed new number"}
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-blue-900">
                    {action.phone}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {review && (
          <p className="text-sm leading-relaxed text-m-text" role="status">
            {review.explanation}
          </p>
        )}
        {review?.targets &&
          review.targets.length > 1 &&
          !action &&
          review.status === "blocked" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 text-xs font-medium text-m-text">
                Address to update
                <select
                  value={addressId}
                  onChange={(event) => setAddressId(event.target.value)}
                  disabled={running}
                  className="mt-2 w-full rounded-lg border border-m-border bg-m-surface p-2.5 text-sm"
                >
                  <option value="">Select a customer address</option>
                  {review.targets.map((target) => (
                    <option value={target.id} key={target.id}>
                      {target.label} · {target.phone || "No phone"} · {target.id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!addressId || running}
                onClick={() => {
                  void request("analyze", { refresh: true, addressId });
                }}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Prepare proposal
              </button>
            </div>
          )}

        {review?.informationRequest && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-m-text">
            <p className="font-semibold">
              {review.informationRequest.status === "accepted"
                ? "Information request accepted for delivery — waiting for customer"
                : review.informationRequest.status === "rejected"
                  ? "Information email rejected — agent follow-up needed"
                  : "Email outcome unconfirmed — check provider activity before resending"}
            </p>
            <p className="mt-2">To: {review.informationRequest.recipient}</p>
            <p>{review.informationRequest.subject}</p>
            <p className="mt-2 whitespace-pre-wrap">{review.informationRequest.text}</p>
          </div>
        )}
        {review?.informationRequestError && (
          <p role="alert" className="text-sm text-red-600">
            {review.informationRequestError}
          </p>
        )}

        <div className="flex items-start gap-2 text-xs leading-relaxed text-m-text-muted">
          <ShieldCheck
            size={17}
            className="mt-0.5 shrink-0 text-blue-600"
            aria-hidden="true"
          />
          <p>
            AI guidance covers every identified customer query. Validated contact-number
            changes for one address named in the ticket and same-destination shipping
            corrections can run automatically. Returns, cancellations, ambiguous changes,
            and customer emails require agent approval. Actions and results are saved with
            this ticket. Response drafts are not sent automatically.
          </p>
        </div>

        {review?.approvedBy && (
          <p className="text-xs text-m-text-muted">
            Approved by {review.approvedBy}
            {review.approvedAt
              ? ` · ${new Date(review.approvedAt).toLocaleString()}`
              : ""}
          </p>
        )}
        {review?.status === "succeeded" && ticket.status !== "Closed" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-950">
              {zendesk ? "Resolve this ticket?" : "Close this ticket?"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-blue-900">
              {review.findingsApproved
                ? "The findings are approved. Complete any outstanding actions and customer follow-up before closing."
                : "The requested change is complete."}{" "}
              Approving below changes this ticket’s status from {ticket.status} to{" "}
              {zendesk
                ? "Resolved (solved in Zendesk) and adds a private resolution note. Zendesk manages final closure"
                : "Closed"}
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="mb-2 block w-full text-sm font-semibold text-blue-950">
                Resolution / Solution Notes
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={resolutionNotes}
                  onChange={(event) => setEditedResolution(event.target.value)}
                  disabled={running}
                  placeholder="Enter resolution notes or solution provided to customer…"
                  className="mt-2 w-full resize-y rounded-xl border border-blue-200 bg-white p-3 text-sm font-normal leading-relaxed text-m-text outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-70"
                />
                <span className="mt-1 block text-xs font-normal text-m-text-muted">
                  Prefilled from the completed review. Review or edit before approving.
                  Your final notes will be saved when the ticket closes.
                </span>
              </label>
              <button
                type="button"
                disabled={
                  running ||
                  Boolean(error) ||
                  !resolutionNotes.trim() ||
                  resolutionNotes.trim().length > 5000
                }
                onClick={() => {
                  void request("approve_close", {
                    revision: review.revision,
                    resolutionNotes
                  });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600 disabled:opacity-40"
              >
                <Check size={15} aria-hidden="true" />
                Approve & {completionVerb} ticket
              </button>
              <button
                type="button"
                disabled={running || Boolean(error)}
                onClick={() => {
                  void request("keep_open", { revision: review.revision });
                }}
                className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-xs font-semibold text-blue-900 disabled:opacity-40"
              >
                Keep open
              </button>
            </div>
          </div>
        )}
        {review?.status === "succeeded" && ticket.status === "Closed" && (
          <p className="text-sm text-m-text">This ticket is already closed.</p>
        )}
        {review?.closeApprovedBy && (
          <p className="text-xs text-m-text-muted">
            Closure approved by {review.closeApprovedBy}
            {review.closeApprovedAt
              ? ` · ${new Date(review.closeApprovedAt).toLocaleString()}`
              : ""}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-m-border pt-4">
          {review?.status === "pending" && (
            <>
              <button
                type="button"
                disabled={running || Boolean(error)}
                onClick={() => {
                  void request("approve", { revision: review.revision });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600 disabled:opacity-40"
              >
                <Check size={15} aria-hidden="true" />
                {review.informationQuestions?.length
                  ? "Approve & request information"
                  : review.orderAction
                  ? review.orderAction.kind === "start_return"
                    ? "Approve & record return"
                    : "Approve & apply order change"
                  : review.orderProposal
                    ? "Approve findings"
                    : review.action
                      ? "Approve & update phone"
                      : "Approve"}
              </button>
              <button
                type="button"
                disabled={running || Boolean(error)}
                onClick={() => {
                  void request("decline", { revision: review.revision });
                }}
                className="rounded-lg border border-m-border px-4 py-2.5 text-xs font-semibold text-m-text disabled:opacity-40"
              >
                Decline
              </button>
            </>
          )}
          {refreshable && (
            <button
              type="button"
              onClick={() => {
                void request("analyze", { refresh: true });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-m-border px-3 py-2.5 text-xs font-semibold text-m-text hover:bg-m-surface-2"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Analyze again
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
