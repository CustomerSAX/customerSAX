"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConversationStore } from "../store/conversation-store";
import { CreateOrderStepper, EMPTY_LOCAL_ORDER_DRAFT, type LocalOrderDraft } from "./steppers/CreateOrderStepper";
import { CreateTicketStepper, EMPTY_LOCAL_TICKET_DRAFT, type LocalTicketDraft } from "./steppers/CreateTicketStepper";
import { ReturnStepper, EMPTY_LOCAL_RETURN_DRAFT, type LocalReturnDraft } from "./steppers/ReturnStepper";
import { MemoryPanel } from "./MemoryPanel";
import { ChatHistory } from "./ChatHistory";

// ─── Confidence Gauge ─────────────────────────────────────────────────────────

function ConfidenceGauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 26, c = 2 * Math.PI * r;
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#d97706" : "#dc2626";
  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      <svg className="csa-gauge" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eef2ff" strokeWidth="6" />
        <circle
          className="csa-gauge-fill"
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color,
      }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 750): number {
  const safe = Number.isFinite(target) ? target : 0;
  const [val, setVal] = useState(safe);
  const from = useRef(safe);
  useEffect(() => {
    const start = from.current;
    if (start === safe) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(start + (safe - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { from.current = safe; setVal(safe); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safe, duration]);
  return val;
}

// ─── Sentiment colours ────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Positive:            { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  Neutral:             { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  "Slightly Negative": { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  Negative:            { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  Frustrated:          { color: "#b91c1c", bg: "#fff1f2", border: "#fecdd3" },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ContextPanelProps {
  onSendMessage?: (text: string) => void;
  isLoading?: boolean;
  onContinueConversation?: (sessionId: string, pageContext: { type: string; id: string } | null) => void;
}

export function ContextPanel({ onSendMessage, isLoading = false, onContinueConversation }: ContextPanelProps) {
  const customer       = useConversationStore((s) => s.customer);
  const context        = useConversationStore((s) => s.context);
  const insights       = useConversationStore((s) => s.insights);
  const resolution     = useConversationStore((s) => s.resolution);
  const machineState   = useConversationStore((s) => s.machineState);
  const contextLoading = useConversationStore((s) => s.contextLoading);
  const activeTicketId = useConversationStore((s) => s.activeTicketId);
  const activeTab      = useConversationStore((s) => s.rightPanelTab);
  const setActiveTab   = useConversationStore((s) => s.setRightPanelTab);

  const activeStepper    = useConversationStore((s) => s.activeStepper);
  const setActiveStepper = useConversationStore((s) => s.setActiveStepper);
  const orderWorkflow    = useConversationStore((s) => s.orderWorkflow);
  const ticketWorkflow   = useConversationStore((s) => s.ticketWorkflow);
  const returnWorkflow   = useConversationStore((s) => s.returnWorkflow);

  // Stepper local states — step is a string key
  const [createOrderStep, setCreateOrderStep]   = useState<string>('customer');
  const [orderLocalDraft, setOrderLocalDraft]   = useState<LocalOrderDraft>({ ...EMPTY_LOCAL_ORDER_DRAFT });
  const [createTicketStep, setCreateTicketStep] = useState<string>('customer');
  const [ticketLocalDraft, setTicketLocalDraft] = useState<LocalTicketDraft>({ ...EMPTY_LOCAL_TICKET_DRAFT });
  const [createReturnStep, setCreateReturnStep] = useState<string>('order');
  const [returnLocalDraft, setReturnLocalDraft] = useState<LocalReturnDraft>({ ...EMPTY_LOCAL_RETURN_DRAFT });

  const sendAction = (action: Record<string, unknown>) => {
    if (onSendMessage) {
      onSendMessage(`[hidden-action] ${JSON.stringify(action)}`);
    }
  };

  const sessionId    = activeTicketId;
  const activeOrder  = context.orders[0] ?? null;
  const activeTicket = activeTicketId
    ? (context.tickets.find((t) => t.id === activeTicketId) ?? context.tickets[0] ?? null)
    : (context.tickets[0] ?? null);

  const initials = customer?.name
    ? customer.name.split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const hasAnalysis = !!(
    insights.intent ||
    (insights.sentiment && insights.sentiment !== "Neutral") ||
    insights.confidence > 0
  );
  const sentimentCfg = SENTIMENT_COLORS[insights.sentiment ?? ""] ?? SENTIMENT_COLORS["Neutral"];
  const isNegativeSentiment = insights.sentiment === "Negative" || insights.sentiment === "Frustrated";
  const nextSteps: string[] = Array.isArray(resolution?.nextSteps) && resolution.nextSteps.length > 0
    ? (resolution.nextSteps as string[]).slice(0, 4)
    : [];
  const animatedOrders = useCountUp(typeof customer?.orderCount === "number" ? customer.orderCount : 0);
  const showCustomerSkeleton = contextLoading && !customer;

  return (
    <div className="sb-container" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>

      {/* ── Tabs ── */}
      {activeStepper ? (
        <div className="csa-stepper-tabs" style={{ display: 'flex', borderBottom: '1px solid #e4e7ec', background: '#fff', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setActiveStepper("order")}
            style={{
              flex: 1, padding: '12px 8px', border: 'none',
              background: activeStepper === "order" ? '#FFF1E7' : 'none',
              color: activeStepper === "order" ? '#ea580c' : '#475467',
              borderBottom: activeStepper === "order" ? '3px solid #ea580c' : 'none',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'center'
            }}
          >
            🛒 Create Order
          </button>
          <button
            type="button"
            onClick={() => setActiveStepper("ticket")}
            style={{
              flex: 1, padding: '12px 8px', border: 'none',
              background: activeStepper === "ticket" ? '#EFF8FF' : 'none',
              color: activeStepper === "ticket" ? '#175cd3' : '#475467',
              borderBottom: activeStepper === "ticket" ? '3px solid #175cd3' : 'none',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'center'
            }}
          >
            🎫 Escalate Ticket
          </button>
          <button
            type="button"
            onClick={() => setActiveStepper("return")}
            style={{
              flex: 1, padding: '12px 8px', border: 'none',
              background: activeStepper === "return" ? '#F5F3FF' : 'none',
              color: activeStepper === "return" ? '#6d28d9' : '#475467',
              borderBottom: activeStepper === "return" ? '3px solid #6d28d9' : 'none',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'center'
            }}
          >
            ↩️ Return/Refund
          </button>
        </div>
      ) : (
        <div className="sb-tabs">
          <button
            className={`sb-tab ${activeTab === 'intelligence' ? 'active' : ''}`}
            onClick={() => setActiveTab('intelligence')}
          >
            Context
          </button>
          <button
            className={`sb-tab ${activeTab === 'chatHistory' ? 'active' : ''}`}
            onClick={() => setActiveTab('chatHistory')}
          >
            Conversations
          </button>
          <button
            className={`sb-tab ${activeTab === 'memory' ? 'active' : ''}`}
            onClick={() => setActiveTab('memory')}
          >
            Memory
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>

        {activeStepper === "order" ? (
          <CreateOrderStepper
            step={createOrderStep}
            setStep={setCreateOrderStep}
            workflow={orderWorkflow}
            localDraft={orderLocalDraft}
            setLocalDraft={setOrderLocalDraft}
            onAction={sendAction}
            isLoading={isLoading}
            onClose={() => setActiveStepper(null)}
          />
        ) : activeStepper === "ticket" ? (
          <CreateTicketStepper
            step={createTicketStep}
            setStep={setCreateTicketStep}
            workflow={ticketWorkflow}
            localDraft={ticketLocalDraft}
            setLocalDraft={setTicketLocalDraft}
            onAction={sendAction}
            isLoading={isLoading}
            onClose={() => setActiveStepper(null)}
          />
        ) : activeStepper === "return" ? (
          <ReturnStepper
            step={createReturnStep}
            setStep={setCreateReturnStep}
            workflow={returnWorkflow}
            localDraft={returnLocalDraft}
            setLocalDraft={setReturnLocalDraft}
            onAction={sendAction}
            isLoading={isLoading}
            onClose={() => setActiveStepper(null)}
          />
        ) : activeTab === "chatHistory" ? (
          <div className="sb-content">
            <ChatHistory onContinue={onContinueConversation} />
          </div>
        ) : activeTab === "intelligence" ? (
          <div className="sb-content">
            {/* ── Customer Overview ── */}
            <section>
              <div className="sb-section-header">
                <h2 className="sb-section-title">Customer</h2>
                {customer && <a href="#" className="sb-link">View full</a>}
              </div>

              {showCustomerSkeleton ? (
                <div className="sb-customer">
                  <div className="csa-skel" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
                  <div className="sb-customer-info" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                    <div className="csa-skel" style={{ height: 14, width: '55%' }} />
                    <div className="csa-skel" style={{ height: 11, width: '80%' }} />
                    <div className="csa-skel" style={{ height: 11, width: '40%' }} />
                  </div>
                </div>
              ) : customer ? (
                <>
                  <div className="sb-customer csa-enter">
                    <div className="sb-customer-avatar">{initials}</div>
                    <div className="sb-customer-info">
                      <div className="sb-customer-header">
                        <div className="sb-customer-name">{customer.name}</div>
                        <div style={{
                          backgroundColor: '#ecfdf5', color: '#065f46',
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                          borderRadius: '4px', border: '1px solid #a7f3d0',
                        }}>
                          Identified
                        </div>
                      </div>
                      <div className="sb-customer-detail">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {customer.email ?? '–'}
                      </div>
                      {customer.phone && (
                        <div className="sb-customer-detail">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sb-stats-grid">
                    <div>
                      <div className="sb-stat-label">Since</div>
                      <div className="sb-stat-value">{customer.createdAt ?? '–'}</div>
                    </div>
                    <div>
                      <div className="sb-stat-label">Orders</div>
                      <div className="sb-stat-value">{customer.orderCount != null ? Math.round(animatedOrders) : '–'}</div>
                    </div>
                    <div>
                      <div className="sb-stat-label">Spent</div>
                      <div className="sb-stat-value">{customer.lifetimeValue ?? '–'}</div>
                    </div>
                    <div>
                      <div className="sb-stat-label">Tier</div>
                      <div className="sb-stat-value">
                        {customer.status ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            backgroundColor: '#fef3c7', color: '#b45309',
                            fontSize: '10px', fontWeight: 700, padding: '2px 6px',
                            borderRadius: '4px', border: '1px solid #fde68a',
                          }}>
                            {customer.status}
                          </span>
                        ) : '–'}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="sb-empty-context">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p>No customer identified yet.</p>
                  <span>Customer details populate automatically once the AI identifies the customer.</span>
                </div>
              )}
            </section>

            {/* ── Active Context (order + ticket + channel) ── */}
            {(activeOrder || activeTicket) && (
              <>
                <hr className="sb-divider" />
                <section>
                  <div className="sb-section-header">
                    <h2 className="sb-section-title">Active Context</h2>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {activeOrder && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: '8px', backgroundColor: '#f9fafb',
                        border: '1px solid #f3f4f6',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>Order</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link href={`/orders/${activeOrder.id}`} style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>
                            {(() => {
                              const raw = (activeOrder.orderNumber as string) || (activeOrder.id as string) || '';
                              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
                              const disp = isUuid ? raw.slice(-6).toUpperCase() : raw;
                              return disp.startsWith('#') ? disp : `#${disp}`;
                            })()}
                          </Link>
                          <span style={{
                            fontSize: '10px', fontWeight: 600,
                            backgroundColor: '#fffbeb', color: '#b45309',
                            border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px',
                          }}>
                            {(activeOrder.status as string) || 'Complete'}
                          </span>
                        </div>
                      </div>
                    )}

                    {activeTicket && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: '8px', backgroundColor: '#f9fafb',
                        border: '1px solid #f3f4f6',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>Ticket</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link href={`/tickets/${activeTicket.id}`} style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>
                            {(activeTicket.ticketNumber as string) || (activeTicket.id as string)}
                          </Link>
                          <span style={{
                            fontSize: '10px', fontWeight: 600,
                            backgroundColor: '#eef2ff', color: '#4f46e5',
                            border: '1px solid #e0e7ff', padding: '1px 6px', borderRadius: '4px',
                          }}>
                            {(activeTicket.status as string) || 'open'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Channel */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: '8px', backgroundColor: '#f9fafb',
                      border: '1px solid #f3f4f6',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Channel</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                        Web Chat
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )}

            <hr className="sb-divider" />

            {/* ── AI Analysis ── */}
            <section>
              <div className="sb-section-header">
                <h2 className="sb-section-title">AI Analysis</h2>
                {machineState && machineState !== 'OPEN' && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    backgroundColor: '#eef2ff', color: '#4338ca',
                    border: '1px solid #e0e7ff',
                    padding: '2px 8px', borderRadius: '999px',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {String(machineState).replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              {!hasAnalysis ? (
                isLoading ? (
                  <div className="sb-empty-context">
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      border: '2px solid #e0e7ff', borderTopColor: '#4f46e5',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto 8px',
                    }} />
                    <p style={{ color: '#4338ca' }}>Analyzing session…</p>
                    <span>AI is reading customer profile, orders, and ticket history.</span>
                  </div>
                ) : (
                  <div className="sb-empty-context">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p>No analysis yet</p>
                    <span>Select a customer session to begin. AI will analyse the issue automatically.</span>
                  </div>
                )
              ) : (
                <div>
                  {/* Intent + Sentiment pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {insights.intent && (
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        backgroundColor: '#eef2ff', color: '#4338ca',
                        border: '1px solid #e0e7ff',
                        padding: '3px 10px', borderRadius: '999px',
                        textTransform: 'capitalize',
                      }}>
                        {insights.intent.replace(/_/g, ' ')}
                      </span>
                    )}
                    {insights.sentiment && (
                      <span
                        className={isNegativeSentiment ? 'csa-sentiment-pulse' : undefined}
                        style={{
                          fontSize: '11px', fontWeight: 600,
                          backgroundColor: sentimentCfg.bg,
                          color: sentimentCfg.color,
                          border: `1px solid ${sentimentCfg.border}`,
                          padding: '3px 10px', borderRadius: '999px',
                        }}
                      >
                        {insights.sentiment}
                      </span>
                    )}
                  </div>

                  {/* Confidence gauge */}
                  {insights.confidence > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                      <ConfidenceGauge value={insights.confidence} />
                      <div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                          Confidence
                        </div>
                        <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.4 }}>
                          {insights.confidence >= 70 ? 'High — ready to act' : insights.confidence >= 40 ? 'Moderate — verifying' : 'Low — gathering info'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Strategy */}
                  {resolution?.strategy && (
                    <div style={{
                      marginBottom: '14px', padding: '8px 10px',
                      backgroundColor: '#f8fafc', borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        Strategy
                      </div>
                      <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
                        {resolution.strategy as string}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Suggested Next Steps */}
              {nextSteps.length > 0 && (
                <div style={{ marginTop: hasAnalysis ? '4px' : '0' }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 700, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    marginBottom: '8px',
                  }}>
                    Suggested Actions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {nextSteps.map((stepText, i) => (
                      <button
                        key={i}
                        onClick={() => onSendMessage?.(stepText)}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '9px 12px',
                          border: '1px solid #e0e7ff',
                          borderRadius: '8px',
                          backgroundColor: '#f5f7ff',
                          color: '#3730a3',
                          fontSize: '12px', fontWeight: 500,
                          cursor: onSendMessage ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          lineHeight: '1.4',
                          transition: 'background-color 0.12s',
                        }}
                        onMouseEnter={(e) => { if (onSendMessage) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ebe8ff'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f7ff'; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                          <path d="M10 1 C10.8 5.5 12.5 7.5 18 10 C12.5 12.5 10.8 14.5 10 19 C9.2 14.5 7.5 12.5 2 10 C7.5 7.5 9.2 5.5 10 1 Z" fill="#4f46e5" />
                        </svg>
                        {stepText}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="sb-content">
            <MemoryPanel sessionId={sessionId} />
          </div>
        )}
      </div>
    </div>
  );
}
