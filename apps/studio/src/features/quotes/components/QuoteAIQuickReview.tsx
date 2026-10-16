"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogAccessibility } from "@csa/ui";
import { AIStatusBadge } from "@/features/tickets/components/AIStatusBadge";
import { QuoteAIReview } from "./QuoteAIReview";

export const QUOTE_AI_STATUS_DESCRIPTIONS: Record<string, string> = {
  not_analyzed: "No saved AI review yet. Click to analyze this quote request.",
  analyzing: "AI is reviewing the quote request.",
  agent_input_needed: "The agent needs to resolve open questions or decide this request manually.",
  awaiting_approval: "An AI recommendation to accept or reject is ready for approval.",
  ai_working: "An approved quote request decision is being applied.",
  action_completed: "The approved decision was confirmed by commercetools.",
  review_completed: "This quote request was decided outside the AI review.",
  review_needed: "The quote request changed after the review; analyze it again.",
  check_outcome: "The decision outcome is uncertain. Check the quote request before retrying.",
  analysis_failed: "AI analysis failed; open the review to retry.",
  unavailable: "The saved AI status could not be loaded. Check AI Assist and refresh."
};

export function QuoteAIQuickReview({
  quoteId,
  quoteNumber,
  status,
  onChanged
}: {
  quoteId: string;
  quoteNumber: string;
  status?: string;
  onChanged: () => unknown;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 100, left: 16, maxHeight: 600 });
  const trigger = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const close = useCallback(() => setOpen(false), []);
  const dialog = useDialogAccessibility<HTMLDivElement>({ isOpen: open, onClose: close });

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(660, window.innerWidth - 32);
      const maxHeight = Math.min(680, window.innerHeight - 48);
      const top = Math.max(16, Math.min(rect.bottom + 10, window.innerHeight - maxHeight - 16));
      setPosition({ left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)), top, maxHeight });
    };
    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open]);

  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open}
      aria-label={`Review AI status for quote ${quoteNumber}`}
      title="Review and decide this quote request here"
      className="rounded-full text-left outline-none ring-offset-2 transition hover:ring-2 hover:ring-blue-200 focus-visible:ring-2 focus-visible:ring-blue-600"
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); setOpen(true); }}>
      <AIStatusBadge status={status} descriptions={QUOTE_AI_STATUS_DESCRIPTIONS} />
    </button>
    {open && createPortal(
      <div className="fixed inset-0 z-[100] bg-slate-950/15" onClick={event => { event.stopPropagation(); close(); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}
          onClick={event => event.stopPropagation()}
          className="fixed flex w-[min(660px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-m-border bg-m-surface text-m-text shadow-2xl whitespace-normal"
          style={position}>
          <header className="flex shrink-0 items-start gap-3 border-b border-m-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={headingId} className="text-sm font-semibold">Quick AI review · {quoteNumber}</h2>
            </div>
            <button type="button" aria-label="Close quick AI review" onClick={close} className="rounded-lg p-1.5 hover:bg-m-surface-2"><X size={18} aria-hidden /></button>
          </header>
          <div className="min-h-0 overflow-y-auto p-3">
            <QuoteAIReview key={quoteId} quoteId={quoteId} onQuoteChanged={onChanged} initialOperation="load" />
          </div>
        </div>
      </div>, document.body
    )}
  </>;
}
