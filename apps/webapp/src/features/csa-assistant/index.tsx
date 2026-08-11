"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessType, SessionContext } from "./types";
import { useCsaChat } from "./hooks/use-csa-chat";
import { useConversationStore } from "./store/conversation-store";
import { ConversationList } from "./components/ConversationList";
import { ChatStream } from "./components/ChatStream";
import { ContextPanel } from "./components/ContextPanel";
import { useCurrentUser, roleLabel } from "@/lib/use-current-user";

// This deployment is wired to a single commercetools project (see the
// architecture note in CLAUDE.md) — its key/business type come from real
// config, not a guess. Neither variable falls back to a literal here: if
// they're unset the assistant just doesn't get a projectKey/businessType,
// which is the honest state, not a fabricated one.
const CT_PROJECT_KEY = process.env.NEXT_PUBLIC_CT_PROJECT_KEY || undefined;
const rawBusinessType = process.env.NEXT_PUBLIC_CT_BUSINESS_TYPE;
const CT_BUSINESS_TYPE: BusinessType | undefined =
  rawBusinessType === "b2b" || rawBusinessType === "b2c" ? rawBusinessType : undefined;

export function CsaAssistant() {
  // ConversationStore bindings
  const activeTicketId   = useConversationStore((s) => s.activeTicketId);
  const customer         = useConversationStore((s) => s.customer);
  const storeRightOpen   = useConversationStore((s) => s.rightPanelOpen);
  const activeStepper    = useConversationStore((s) => s.activeStepper);
  const newConversationNonce = useConversationStore((s) => s.newConversationNonce);

  // Real logged-in identity — never a placeholder. userEmail/userRole stay
  // undefined until the session loads; ai-assist has its own defensive
  // fallback for that brief window, but every real request now carries the
  // actual agent's identity instead of a fixed literal.
  const { user } = useCurrentUser();

  // Dynamic session context with active pageContext
  const sessionContext: SessionContext = {
    userEmail: user?.email,
    userRole: user ? roleLabel(user.role) : undefined,
    projectKey: CT_PROJECT_KEY,
    businessType: CT_BUSINESS_TYPE,
    pageContext: activeTicketId
      ? { type: "ticket", id: activeTicketId }
      : customer?.id
      ? { type: "customer", id: customer.id }
      : null,
  };

  const chat = useCsaChat(sessionContext);
  const [rightPanelOpen, setRightPanelOpenLocal] = useState(false);

  // Sync right panel open state from the store — force open when a stepper is active
  useEffect(() => { setRightPanelOpenLocal(storeRightOpen || !!activeStepper); }, [storeRightOpen, activeStepper]);

  // ── Pending briefing: auto-send when user selects a ticket ────────────────
  const prevTicketId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTicketId || activeTicketId === prevTicketId.current) return;
    prevTicketId.current = activeTicketId;

    // Clear the chat for the new ticket
    chat.setMessages([]);

    // Auto-send the pending briefing (queued by ConversationList)
    const pending = (window as unknown as Record<string, unknown>).__csaPendingBriefing as
      | { ticketId: string; contextLines: string }
      | null
      | undefined;

    if (pending && pending.ticketId === activeTicketId) {
      // Deliberately NOT asking for "a case briefing" in words here — the
      // system prompt's ticket pageContext block already mandates rendering
      // case_briefing_card plus a short greeting on this first response.
      // Asking for a briefing here too doubled the instruction and produced
      // the same details twice: once as a bulleted prose dump, once as the
      // card.
      const prompt = [
        `I just opened this ticket. Here is the context:`,
        pending.contextLines,
      ].join("\n");

      // Small delay so the messages array clears first
      setTimeout(() => {
        chat.sendSuggestion(prompt);
        const clearFn = (window as unknown as Record<string, unknown>).__csaClearBriefing;
        if (typeof clearFn === "function") (clearFn as () => void)();
      }, 100);
    }
  }, [activeTicketId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── "New Conversation" clicked ────────────────────────────────────────────
  // activeTicketId alone can't drive this: clicking "New Conversation" sets it
  // to null, but the effect above only clears messages when activeTicketId
  // becomes truthy (switching TO a ticket) — its guard skips the null case
  // entirely. Without this, the panel (customer, AI Analysis) reset correctly
  // but the old chat transcript stayed on screen. newConversationNonce is
  // bumped on every click regardless of what activeTicketId was/is, so this
  // always fires.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    chat.setMessages([]);
    prevTicketId.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newConversationNonce]);

  // ── Send suggestion from right panel ─────────────────────────────────────
  const handleSendMessage = useCallback(
    (text: string) => { chat.sendSuggestion(text); },
    [chat]
  );

  const sessionCustomerName = customer?.name;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: rightPanelOpen
          ? "300px minmax(0,1fr) 450px"
          : "300px minmax(0,1fr)",
        gap: 0,
        height: "100%",
        minHeight: 540,
        overflow: "hidden",
        transition: "grid-template-columns 0.2s ease",
      }}
    >
      {/* Left pane — conversation list (self-contained, reads its own data) */}
      <div style={{ borderRight: "1px solid #e5e7eb", overflow: "hidden" }}>
        <ConversationList />
      </div>

      {/* Center pane — streaming chat */}
      <ChatStream
        chat={chat}
        sessionCustomerName={sessionCustomerName}
      />

      {/* Right pane — context + AI analysis (only when a ticket is selected) */}
      {rightPanelOpen && (
        <div style={{ borderLeft: "1px solid #e5e7eb", overflow: "hidden" }}>
          <ContextPanel
            onSendMessage={handleSendMessage}
            isLoading={chat.isLoading}
          />
        </div>
      )}
    </div>
  );
}
