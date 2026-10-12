"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogAccessibility } from "@csa/ui";
import type { Ticket } from "../types/ticket-types";
import { AIStatusBadge } from "./AIStatusBadge";
import { TicketAIReview } from "./TicketAIReview";

export function TicketAIQuickReview({ ticket, onTicketChanged }: {
  ticket: Ticket;
  onTicketChanged: () => Promise<unknown>;
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

  if (ticket.aiStatus === "not_supported") return <AIStatusBadge status={ticket.aiStatus} />;
  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open}
      aria-label={`Review AI status for ticket ${ticket.ticketNumber}`}
      title="Review and act on this ticket here"
      className="rounded-full text-left outline-none ring-offset-2 transition hover:ring-2 hover:ring-blue-200 focus-visible:ring-2 focus-visible:ring-blue-600"
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); setOpen(true); }}>
      <AIStatusBadge status={ticket.aiStatus} />
    </button>
    {open && createPortal(
      <div className="fixed inset-0 z-[100] bg-slate-950/15" onClick={event => { event.stopPropagation(); close(); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}
          onClick={event => event.stopPropagation()}
          className="fixed flex w-[min(660px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-m-border bg-m-surface text-m-text shadow-2xl whitespace-normal"
          style={position}>
          <header className="flex shrink-0 items-start gap-3 border-b border-m-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={headingId} className="text-sm font-semibold">Quick AI review · {ticket.ticketNumber}</h2>
              <p className="mt-1 break-words text-xs text-m-text-muted">{ticket.subject}</p>
            </div>
            <button type="button" aria-label="Close quick AI review" onClick={close} className="rounded-lg p-1.5 hover:bg-m-surface-2"><X size={18} aria-hidden /></button>
          </header>
          <div className="min-h-0 overflow-y-auto p-3">
            <TicketAIReview key={ticket.id} ticket={ticket} onTicketChanged={onTicketChanged} initialOperation="load" />
          </div>
        </div>
      </div>, document.body
    )}
  </>;
}
