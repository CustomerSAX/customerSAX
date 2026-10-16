"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

type Review = {
  revision: string;
  status:
    | "analyzing"
    | "pending"
    | "blocked"
    | "executing"
    | "succeeded"
    | "declined"
    | "stale"
    | "failed"
    | "uncertain";
  quoteState: string | null;
  summary: string;
  explanation: string;
  analysis?: {
    recommendation: "accept" | "reject" | "needs_information";
    reason: string;
    findings: string[];
    missingInformation: string[];
    responseDraft: string;
  };
  action: { state: "Accepted" | "Rejected"; expectedVersion: number } | null;
  result?: { version: number; quoteRequestState: string };
  approvedBy?: string;
  approvedAt?: string;
};
const labels: Record<Review["status"], string> = {
  analyzing: "Analyzing quote",
  pending: "Awaiting approval",
  blocked: "Needs review",
  executing: "Updating CT",
  succeeded: "Decision applied",
  declined: "Declined",
  stale: "Proposal out of date",
  failed: "Analysis unavailable",
  uncertain: "Check CT outcome"
};
const recommendations = {
  accept: "Recommend accepting",
  reject: "Recommend rejecting",
  needs_information: "Needs agent review"
};

export function QuoteAIReview({
  quoteId,
  onQuoteChanged,
  initialOperation = "load"
}: {
  quoteId: string;
  onQuoteChanged?: () => unknown;
  initialOperation?: "load" | "analyze";
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const request = useCallback(
    async (operation: string, options: Record<string, unknown> = {}) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/quotes/ai-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ operation, quoteId, ...options })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load the proposal.");
        if (mounted.current) setReview(data.review);
        if (operation !== "load") await onQuoteChanged?.();
      } catch (cause) {
        if (mounted.current)
          setError(cause instanceof Error ? cause.message : "Unable to load the proposal.");
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [quoteId, onQuoteChanged]
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
    if (busy || error || !review || !["analyzing", "executing"].includes(review.status)) return;
    const timer = window.setTimeout(() => {
      void request("load");
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [busy, error, review, request]);

  const running = busy || review?.status === "analyzing" || review?.status === "executing";
  const refreshable =
    !running && !review?.result && review?.status !== "succeeded" && review?.status !== "uncertain";
  const analysis = review?.analysis;

  return (
    <section
      aria-labelledby={`quote-ai-review-${quoteId}`}
      className="overflow-hidden rounded-2xl border border-blue-200 bg-m-surface shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-m-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Sparkles size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id={`quote-ai-review-${quoteId}`} className="text-sm font-semibold text-m-text">
              AI quote review & approval
            </h2>
            <p className="mt-0.5 text-xs text-m-text-muted">
              Review the recommendation before the quote request changes
            </p>
          </div>
        </div>
        <span
          role="status"
          className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700"
        >
          {running && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {review ? labels[review.status] : busy ? "Loading review" : "Not analyzed"}
        </span>
      </header>
      <div className="space-y-5 p-5">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void request("load");
              }}
              className="ml-2 font-semibold underline"
            >
              Reload status
            </button>
          </div>
        )}
        {!review && !busy && !error && (
          <div className="space-y-3">
            <p className="text-sm text-m-text-muted">
              No AI review yet. Analysis reads the quote request, its line items, and current
              inventory. Nothing changes until you approve.
            </p>
            <button
              type="button"
              onClick={() => {
                void request("analyze");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Sparkles size={14} aria-hidden="true" />
              Analyze quote request
            </button>
          </div>
        )}
        {review?.summary && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
              Request summary
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-m-text">{review.summary}</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-4 rounded-xl border border-m-border p-4">
            <h3 className="text-sm font-semibold">{recommendations[analysis.recommendation]}</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {analysis.findings.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            {!!analysis.missingInformation.length && (
              <div>
                <h4 className="text-xs font-semibold">Information to confirm</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {analysis.missingInformation.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold">Buyer response draft · Not sent</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm">{analysis.responseDraft}</p>
            </div>
            {review?.action && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                <h4 className="font-semibold">
                  {review.result ? "Confirmed quote request change" : "Quote request change requiring approval"}
                </h4>
                <p className="mt-2">
                  {review.result
                    ? `Status changed to ${review.result.quoteRequestState}.`
                    : `Change status from Submitted to ${review.action.state}.`}
                </p>
                {review.action.state === "Rejected" && !review.result && (
                  <p className="mt-2">Reason: {analysis.reason}</p>
                )}
              </div>
            )}
          </div>
        )}

        {review && (
          <p className="text-sm leading-relaxed text-m-text" role="status">
            {review.explanation}
          </p>
        )}

        <div className="flex items-start gap-2 text-xs leading-relaxed text-m-text-muted">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          <p>
            The quote request changes only after you approve an unchanged proposal. Prices,
            discounts, and buyer messages are never changed or sent by this review.
          </p>
        </div>

        {review?.approvedBy && (
          <p className="text-xs text-m-text-muted">
            Approved by {review.approvedBy}
            {review.approvedAt ? ` · ${new Date(review.approvedAt).toLocaleString()}` : ""}
          </p>
        )}
        {review && (
          <div className="flex flex-wrap items-center gap-2 border-t border-m-border pt-4">
            {review.status === "pending" && review.action && (
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
                  {review.action.state === "Accepted" ? "Approve & accept request" : "Approve & reject request"}
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
        )}
      </div>
    </section>
  );
}
