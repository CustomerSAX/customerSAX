"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@csa/ui";
import type { BusinessType, SessionContext } from "./types";
import { useCsaChat } from "./hooks/use-csa-chat";
import { useConversationStore } from "./store/conversation-store";
import { useCartStore } from "./store/cart-store";
import { ConversationList } from "./components/ConversationList";
import { ChatStream } from "./components/ChatStream";
import { ContextPanel } from "./components/ContextPanel";
import { CartProvider } from "./components/CartProvider";
import { CartDrawer } from "./components/CartDrawer";
import { useCurrentUser, roleLabel } from "@/lib/use-current-user";

// This deployment is wired to a single commercetools project (see the
// architecture note in CLAUDE.md) — its key/business type come from real
// config, not a guess. Neither variable falls back to a literal here: if
// they're unset the assistant just doesn't get a projectKey/businessType,
// which is the honest state, not a fabricated one.
// localStorage key for persisting the free-form (non-ticket) conversation.
const CHAT_STORAGE_KEY = "csa-chat-messages";

// sessionStorage keys for ticket conversations — scoped per ticket, tab-scoped
// (survives same-tab navigation, cleared on tab close/reload). This lets the
// agent navigate to Orders/Customers and back without losing the ticket transcript.
// Using sessionStorage (not localStorage) so stale conversations don't carry
// over into a new browser session.
const ticketSessionKey = (ticketId: string) => `csa-ticket-msgs-${ticketId}`;

const CT_PROJECT_KEY = process.env.NEXT_PUBLIC_CT_PROJECT_KEY || undefined;
const rawBusinessType = process.env.NEXT_PUBLIC_CT_BUSINESS_TYPE;
const CT_BUSINESS_TYPE: BusinessType | undefined =
  rawBusinessType === "b2b" || rawBusinessType === "b2c" ? rawBusinessType : undefined;

// VIP threshold — the minimum 12-month order total (in project currency) for a
// customer to be considered high-value. Defaults to 50000 (cents or base units,
// matching the system prompt's default) if the env var is not set.
const VIP_THRESHOLD = process.env.NEXT_PUBLIC_CSA_VIP_THRESHOLD || undefined;

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
  const { user, loading } = useCurrentUser();

  // Role-based ACL — agents and admins have full write access; unauthenticated
  // or unknown roles get read-only. This matches the old workspace's behaviour
  // where the ACL collection defaulted writes to false and only granted them
  // explicitly. Until a real per-user ACL store is wired up (Phase 4), roles
  // serve as the coarse-grained gate.
  const isWriter = user?.role === "agent" || user?.role === "admin" || user?.role === "superadmin";

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
    // ACL — explicit flags derived from the authenticated role so ai-assist's
    // secure-by-default (writes=false) doesn't block legitimate agents.
    canViewTickets: true,
    canCreateTickets: isWriter,
    canUpdateTickets: isWriter,
    canViewOrders: true,
    canCreateOrders: isWriter,
    canUpdateOrders: isWriter,
    canViewCustomers: true,
    canCreateCustomers: isWriter,
    canUpdateCustomers: isWriter,
    canViewCarts: true,
    canCreateCarts: isWriter,
    canUpdateCarts: isWriter,
    canViewProducts: true,
    vipThreshold: VIP_THRESHOLD,
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

    // ── Distinguish "fresh ticket open" vs "remount after navigation" ──
    // ConversationList.handleSelectCustomer sets window.__csaPendingBriefing
    // before calling setActiveTicketId. If it's set for this ticket, the agent
    // just clicked it from the list — send a fresh briefing.
    // If it's NOT set, the component remounted (agent navigated away and back)
    // while the Zustand store still held the same activeTicketId — restore
    // the stored transcript from sessionStorage instead of re-sending.
    const pending = (window as unknown as Record<string, unknown>).__csaPendingBriefing as
      | { ticketId: string; contextLines: string }
      | null
      | undefined;

    const isFreshOpen = !!(pending && pending.ticketId === activeTicketId);

    if (!isFreshOpen) {
      // Remount path — try to restore the stored transcript.
      try {
        const stored = sessionStorage.getItem(ticketSessionKey(activeTicketId));
        if (stored) {
          const parsed = JSON.parse(stored) as unknown[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            chat.setMessages(parsed as Parameters<typeof chat.setMessages>[0]);
            return; // Transcript restored — do not re-send the briefing
          }
        }
      } catch { /* corrupted sessionStorage — fall through to fresh briefing */ }
    }

    // Fresh ticket open (or no stored transcript) — clear and send briefing.
    chat.setMessages([]);

    if (isFreshOpen) {
      // Deliberately NOT asking for "a case briefing" in words here — the
      // system prompt's ticket pageContext block already mandates rendering
      // case_briefing_card plus a short greeting on this first response.
      // Asking for a briefing here too doubled the instruction and produced
      // the same details twice: once as a bulleted prose dump, once as the
      // card.
      const prompt = [
        `I just opened this ticket. Here is the context:`,
        pending!.contextLines,
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
    // Mint a fresh session ID so subsequent messages create a new MongoDB record.
    chat.clearSession();
    // Also wipe the persisted transcript so the next mount starts clean.
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
    // Clear the cart so the pill never carries over into a fresh conversation.
    useCartStore.getState().clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newConversationNonce]);

  // ── Ticket conversation persistence ──────────────────────────────────────
  // Persist ticket conversations in sessionStorage (per-ticket, tab-scoped).
  // This lets the agent navigate to Orders/Customers and back without losing
  // the transcript. Capped at 100 messages per ticket.
  useEffect(() => {
    if (!activeTicketId || chat.messages.length === 0) return;
    try {
      sessionStorage.setItem(
        ticketSessionKey(activeTicketId),
        JSON.stringify(chat.messages.slice(-100))
      );
    } catch { /* sessionStorage quota — ignore */ }
  }, [chat.messages, activeTicketId]);

  // ── Chat session persistence ──────────────────────────────────────────────
  // Restore the last free-form conversation once on mount (non-ticket mode
  // only — ticket conversations are handled above via sessionStorage).
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current || activeTicketId) return;
    hasRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        chat.setMessages(parsed);
      }
    } catch { /* corrupted storage — silently ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the conversation whenever messages change, but only in free-form
  // mode. Cap at 100 messages so localStorage doesn't grow unbounded.
  useEffect(() => {
    if (activeTicketId) return; // ticket mode — not persisted here
    if (chat.messages.length === 0) return;
    try {
      const toSave = chat.messages.slice(-100);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
    } catch { /* quota exceeded — ignore */ }
  }, [chat.messages, activeTicketId]);

  // ── Send suggestion from right panel ─────────────────────────────────────
  const handleSendMessage = useCallback(
    (text: string) => { chat.sendSuggestion(text); },
    [chat]
  );

  // ── Continue a past conversation from the History panel ──────────────────
  // When the rep clicks "Continue" on a session card, we restore the session ID
  // so subsequent messages go to the same MongoDB record, and then fetch the
  // stored transcript from ai-assist to reload the chat UI.
  const handleContinueConversation = useCallback(
    async (sessionId: string, pageContext: { type: string; id: string } | null) => {
      chat.restoreSession(sessionId);
      if (pageContext?.type === "ticket" && pageContext.id) {
        // If it was a ticket conversation, reopen that ticket
        const { setActiveTicketId } = useConversationStore.getState();
        setActiveTicketId(pageContext.id);
        return; // ticket effect will handle message restore
      }
      // Free-form conversation — fetch stored messages and restore to chat
      try {
        const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json() as { messages?: Array<{ id?: string; role: string; content: string; createdAt?: string }> };
        if (!Array.isArray(data.messages) || data.messages.length === 0) return;
        // Convert stored { role, content } → UIMessage with text parts
        const uiMessages = data.messages.map((m) => ({
          id: m.id ?? crypto.randomUUID(),
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content }],
          createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
        }));
        chat.setMessages(uiMessages);
      } catch (err) {
        console.error('[CsaAssistant] Failed to restore conversation:', err);
      }
    },
    [chat]
  );

  const sessionCustomerName = customer?.name;

  if (loading) {
    return (
      <div className="flex h-full min-h-[540px] items-center justify-center text-m-text-muted">
        <Icon name="loader" className="animate-spin mr-2" />
        Loading session...
      </div>
    );
  }

  return (
    <>
      {/* Cart provider — watches conversation customer, resolves cart silently */}
      <CartProvider />

      {/* Cart drawer — portal, mounted once, driven by CartStore.isCartOpen */}
      <CartDrawer />

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

        {/* Center pane — streaming chat (CheckoutFlow is rendered inside ChatStream,
            between the messages area and the input bar, so it sits in-chat) */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <ChatStream
            chat={chat}
            sessionCustomerName={sessionCustomerName}
          />
        </div>

        {/* Right pane — context + AI analysis (only when a ticket is selected) */}
        {rightPanelOpen && (
          <div style={{ borderLeft: "1px solid #e5e7eb", overflow: "hidden" }}>
            <ContextPanel
              onSendMessage={handleSendMessage}
              isLoading={chat.isLoading}
              onContinueConversation={handleContinueConversation}
            />
          </div>
        )}
      </div>
    </>
  );
}
