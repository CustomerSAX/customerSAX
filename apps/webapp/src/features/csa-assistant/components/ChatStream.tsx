"use client";

import { useEffect, useRef } from "react";
import { Avatar, Badge, Button, Icon, Input } from "@csa/ui";
import type { UIMessage } from "ai";
import { useConversationStore } from "../store/conversation-store";
import type {
  ActionApprovalArgs,
  CartSummaryArgs,
  CaseBriefingArgs,
  DraftEmailArgs,
  OrderConfirmationArgs,
  OrderSummaryArgs,
  ProductCardArgs,
  RenderRefundActionArgs,
  SuggestedActionsArgs
} from "../types";
import {
  CartSummaryCard,
  CaseBriefingCard,
  DraftEmailCard,
  OrderConfirmationCard,
  OrderSummaryCard,
  ProductCard,
  RenderRefundCard
} from "./ToolCards";
import { ActionApproval } from "./ActionApproval";
import { SuggestedActions } from "./SuggestedActions";
import { Markdown } from "./Markdown";
import type { CsaChat } from "../hooks/use-csa-chat";

// ─── Internal/technical message filtering ──────────────────────────────────
// Stepper actions and the ticket-open auto-briefing are sent through the same
// chat pipe the rep types into, but they're structured payloads meant for the
// model, not something a non-technical rep should ever see rendered as a raw
// bubble ("[hidden-action] {"type":"order.select_customer",...}"). Mirrors
// the old workspace's toDisplayMessages() filter.
const AUTO_CONTEXT_PREFIX = "I just opened this ticket.";

function isInternalMessageText(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith("[hidden-action]") ||
    trimmed.startsWith(AUTO_CONTEXT_PREFIX) ||
    /^\s*functions\.\w+\s*\(/.test(trimmed) ||
    /^\s*\{[\s\S]*"(cartId|orderId|sku|productId|customerId)"/.test(trimmed)
  );
}

/** True when a message has nothing worth showing once internal text parts are excluded. */
function isFullyInternalMessage(message: UIMessage): boolean {
  if (!message.parts || message.parts.length === 0) return false;
  const hasVisibleText = message.parts.some(
    (p) => p.type === "text" && (p as { text?: string }).text && !isInternalMessageText((p as { text: string }).text)
  );
  const hasToolParts = message.parts.some((p) => {
    const type = (p as { type: string }).type;
    return type.startsWith("tool-") && type !== "tool-invocation" || type === "dynamic-tool";
  });
  return !hasVisibleText && !hasToolParts;
}

interface ChatStreamProps {
  chat: CsaChat;
  sessionCustomerName?: string;
}

// ─── Tool card dispatcher ─────────────────────────────────────────────────────

function ToolCallCard({
  toolName,
  args,
  onApprove,
  onDecline,
  onSuggest,
  onRefundConfirm,
  isLoading
}: {
  toolName: string;
  args: unknown;
  onApprove: (cmd: string) => void;
  onDecline: () => void;
  onSuggest: (prompt: string) => void;
  onRefundConfirm: (args: RenderRefundActionArgs) => void;
  isLoading: boolean;
}) {
  // Skip UI-state calls — they're invisible
  if (toolName === "update_ui_state" || toolName === "get_resolution_reasons") return null;

  switch (toolName) {
    case "order_summary":
      return <OrderSummaryCard args={args as OrderSummaryArgs} />;
    case "order_confirmation":
      return <OrderConfirmationCard args={args as OrderConfirmationArgs} />;
    case "cart_summary":
      return <CartSummaryCard args={args as CartSummaryArgs} />;
    case "product_card":
      return <ProductCard args={args as ProductCardArgs} />;
    case "case_briefing_card":
      return <CaseBriefingCard args={args as CaseBriefingArgs} />;
    case "draft_email":
      return <DraftEmailCard args={args as DraftEmailArgs} />;
    case "action_approval":
      return (
        <ActionApproval
          args={args as ActionApprovalArgs}
          onApprove={onApprove}
          onDecline={onDecline}
          isPending={isLoading}
        />
      );
    case "suggested_actions":
      return (
        <SuggestedActions
          args={args as SuggestedActionsArgs}
          onSelect={onSuggest}
          disabled={isLoading}
        />
      );
    case "render_refund_action":
      return (
        <RenderRefundCard
          args={args as RenderRefundActionArgs}
          onConfirm={() => onRefundConfirm(args as RenderRefundActionArgs)}
          onDecline={onDecline}
          isPending={isLoading}
        />
      );
    default:
      return null;
  }
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onApprove,
  onDecline,
  onSuggest,
  onRefundConfirm,
  isLoading
}: {
  message: UIMessage;
  onApprove: (cmd: string) => void;
  onDecline: () => void;
  onSuggest: (prompt: string) => void;
  onRefundConfirm: (args: RenderRefundActionArgs) => void;
  isLoading: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-7 h-7 rounded-full bg-m-primary/10 flex items-center justify-center">
            <Icon name="cpu" size="xs" className="text-m-primary" />
          </div>
        </div>
      )}
      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <Avatar name="AG" size="sm" />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Text bubble — in ai@6+, text is in parts, not message.content */}
        {message.parts?.filter(p => p.type === "text").map((p, i) => {
          const textPart = p as { type: "text"; text: string };
          if (!textPart.text || isInternalMessageText(textPart.text)) return null;
          return (
            <div
              key={`text-${i}`}
              className={`rounded-m-lg px-3.5 py-2.5 ${
                isUser
                  ? "bg-m-primary text-white rounded-tr-sm [&_a]:text-white [&_strong]:text-white"
                  : "bg-m-surface-2 text-m-text rounded-tl-sm"
              }`}
            >
              <Markdown>{textPart.text}</Markdown>
            </div>
          );
        })}

        {/* Tool cards — in ai@6+, ToolUIPart has type `tool-${name}` with invocation fields directly on the part */}
        {message.parts?.map((part, partIdx) => {
          const p = part as { type: string; toolName?: string; state?: string; input?: unknown };
          // Handle both static tool parts (type: 'tool-${name}') and dynamic tool parts
          const isStaticTool = p.type.startsWith("tool-") && p.type !== "tool-invocation";
          const isDynamicTool = p.type === "dynamic-tool";
          if (!isStaticTool && !isDynamicTool) return null;

          const toolName = isDynamicTool ? (p.toolName ?? "") : p.type.slice(5);
          const state = p.state;
          const args = p.input;

          if (state !== "output-available" && state !== "input-available") return null;

          return (
            <ToolCallCard
              key={`${message.id}-part-${partIdx}`}
              toolName={toolName}
              args={args}
              onApprove={onApprove}
              onDecline={onDecline}
              onSuggest={onSuggest}
              onRefundConfirm={onRefundConfirm}
              isLoading={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Loading indicator ────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex-shrink-0 mt-1 w-7 h-7 rounded-full bg-m-primary/10 flex items-center justify-center">
        <Icon name="cpu" size="xs" className="text-m-primary" />
      </div>
      <div className="flex items-center gap-1.5 rounded-m-lg px-3.5 py-2.5 bg-m-surface-2">
        <span className="w-1.5 h-1.5 rounded-full bg-m-text-muted animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-m-text-muted animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-m-text-muted animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function unwrapMcpResult(raw: unknown): any {
  if (!raw) return null;
  if (typeof raw === 'object' && 'content' in raw && Array.isArray((raw as any).content)) {
    const textNode = (raw as any).content.find((c: any) => c.type === 'text' || c.type === 'json');
    if (textNode?.text) {
      try { return JSON.parse(textNode.text); } catch { return textNode.text; }
    }
  }
  return raw;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatStream({ chat, sessionCustomerName }: ChatStreamProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    approveAction,
    sendSuggestion,
    stop
  } = chat;
  const rightPanelOpen    = useConversationStore((s) => s.rightPanelOpen);
  const setRightPanelOpen  = useConversationStore((s) => s.setRightPanelOpen);
  const setRightPanelTab   = useConversationStore((s) => s.setRightPanelTab);

  const bottomRef = useRef<HTMLDivElement>(null);
  const setInsights    = useConversationStore((s) => s.setInsights);
  const setResolution  = useConversationStore((s) => s.setResolution);
  const setMachineState = useConversationStore((s) => s.setMachineState);
  const activeTicketId = useConversationStore((s) => s.activeTicketId);
  const setActiveStepper = useConversationStore((s) => s.setActiveStepper);
  const tickets = useConversationStore((s) => s.context.tickets);
  const customer = useConversationStore((s) => s.customer);
  const contextOrders = useConversationStore((s) => s.context.orders);
  
  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];
  
  const acCustomer = customer?.name || customer?.email || sessionCustomerName;
  const acOrderRef = contextOrders?.[0]?.orderNumber;

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Parse tool calls → ConversationStore ─────────────────
  useEffect(() => {
    let newMachineState: string | undefined;
    let newInsights: any = undefined;
    let newResolution: any = undefined;

    // Customer identified this turn — the ONLY thing that ever populates
    // orderWorkflow.customer.id (cart_summary's `customer` field is name/email
    // only, no id). Without this, CreateOrderStepper's Step 1→2 auto-advance
    // (`workflow?.customer?.id`) can never fire and the stepper looks stuck.
    let newCustomerId: string | undefined;
    let orderCustomerName: string | undefined;
    let orderCartValue: any = undefined;
    let orderPendingApproval: any = undefined;
    let orderPlaced: any = undefined;
    let sawAnyOrderSignal = false;

    let ticketPendingApproval: any = undefined;
    let ticketCreated: any = undefined;
    let sawAnyTicketSignal = false;

    let returnOrder: any = undefined;
    let returnCompleted: any = undefined;
    let returnEligibility: any = undefined;
    let returnPendingApproval: any = undefined;
    let sawAnyReturnSignal = false;

    for (const msg of messages) {
      if (!msg.parts) continue;
      for (const part of msg.parts) {
        const p = part as { type: string; toolName?: string; state?: string; input?: unknown; output?: unknown };
        const isStatic = p.type.startsWith("tool-") && p.type !== "tool-invocation";
        const isDynamic = p.type === "dynamic-tool";
        if (!isStatic && !isDynamic) continue;

        const toolName = isDynamic ? (p.toolName ?? "") : p.type.slice(5);

        if (toolName === "update_ui_state" && p.input) {
          const args = p.input as Record<string, unknown>;
          if (args.machineState || args.workflowStage) {
            const rawStage = String(args.machineState || args.workflowStage).toLowerCase();
            const stageMap: Record<string, string> = {
              greeting: "OPEN",
              identifying_customer: "UNDERSTAND",
              order_inquiry: "UNDERSTAND",
              ticket_inquiry: "UNDERSTAND",
              proposing_action: "PROPOSE",
              executing: "EXECUTE",
              resolved: "RESOLVED",
              closed: "CLOSED",
            };
            newMachineState = stageMap[rawStage] || String(args.machineState || args.workflowStage).toUpperCase().replace(/_/g, " ");
          }
          if (args.confidence !== undefined || args.intent || args.sentiment) {
            newInsights = {
              intent: args.intent ? String(args.intent) : undefined,
              sentiment: args.sentiment ? String(args.sentiment) : undefined,
              confidence: typeof args.confidence === "number" ? args.confidence : 0,
            };
          }
          if (args.strategy || args.nextSteps) {
            newResolution = {
              strategy: args.strategy ? String(args.strategy) : undefined,
              nextSteps: Array.isArray(args.nextSteps) ? (args.nextSteps as string[]) : undefined,
            };
          }
          if (typeof args.customerId === "string" && args.customerId.trim()) {
            newCustomerId = args.customerId.trim();
          }
        }

        // Fallback: pull the customer id straight from a find_customer result
        // in case the model didn't echo it into update_ui_state's customerId.
        if (toolName === 'find_customer' && p.output && !newCustomerId) {
          const result = unwrapMcpResult(p.output);
          const first = result?.customers?.[0] ?? (result?.id ? result : null);
          if (first?.id) {
            newCustomerId = String(first.id);
            if (!orderCustomerName) {
              orderCustomerName = [first.firstName, first.lastName].filter(Boolean).join(' ') || first.email || undefined;
            }
          }
        }

        if (toolName === 'cart_summary' && p.input) {
          const args = p.input as any;
          sawAnyOrderSignal = true;
          // cart_summary's `customer` field is an object ({name, email} — see
          // cartSummarySchema), not a plain string. Assigning it directly
          // rendered the stepper header as "Cart for [object Object]".
          orderCustomerName = args.customer?.name || orderCustomerName;
          orderCartValue = {
            cartId: args.cartId,
            items: (args.items || []).map((it: any) => ({ sku: it.sku, name: it.name, price: it.price, quantity: it.qty })),
            itemCount: args.itemCount,
            total: args.total,
          };
          orderPendingApproval = undefined;
        }

        if (toolName === 'action_approval' && p.input) {
          const args = p.input as any;
          sawAnyOrderSignal = true;
          orderPendingApproval = { action: args.title, summary: args.description };
          sawAnyTicketSignal = true;
          ticketPendingApproval = { action: args.title, summary: args.description };
          sawAnyReturnSignal = true;
          returnPendingApproval = { action: args.title, summary: args.description };
        }

        if (toolName === 'order_confirmation' && p.input) {
          const args = p.input as any;
          sawAnyOrderSignal = true;
          orderPlaced = { orderId: args.orderId, orderNumber: args.orderNumber, total: args.total };
          orderPendingApproval = undefined;
        }

        if (toolName === 'create_ticket' && p.output) {
          const result = unwrapMcpResult(p.output);
          if (result && (result.ticketNumber || result.id || result._id)) {
            sawAnyTicketSignal = true;
            ticketCreated = { ticketNumber: result.ticketNumber, id: result.id || result._id };
            ticketPendingApproval = undefined;
          }
        }

        if (toolName === 'check_return_eligibility' && p.output) {
          const result = unwrapMcpResult(p.output);
          if (result && typeof result.eligible === 'boolean') {
            sawAnyReturnSignal = true;
            returnEligibility = { eligible: result.eligible, reason: result.eligible ? undefined : (Array.isArray(result.reasons) ? result.reasons.join(' ') : undefined) };
            if (result.order) {
              returnOrder = {
                id: result.order.id,
                orderNumber: result.order.orderNumber,
                total: result.order.totalPrice,
                lineItems: Array.isArray(result.order.lineItems) ? result.order.lineItems.map((li: any) => ({ name: li.name, quantity: li.quantity, price: li.price })) : []
              };
            }
          }
        }

        // NOTE: there is no `confirm_action` tool in the current tool set —
        // start_return executes directly once the rep approves (no
        // separate token/confirm step), so this must watch start_return's
        // own output. Watching a tool name that's never called meant
        // returnWorkflow.completed could never populate, leaving the
        // stepper stuck showing "Submitting…" even after a real success.
        if (toolName === 'start_return' && p.output) {
          const result = unwrapMcpResult(p.output);
          if (result?.success) {
            sawAnyReturnSignal = true;
            returnCompleted = {
              type: 'return',
              orderNumber: returnOrder?.orderNumber,
              summary: result.returnTrackingId ? `Return tracking ID: ${result.returnTrackingId}` : undefined
            };
            returnPendingApproval = undefined;
          }
        }
      }
    }

    if (newInsights) setInsights(newInsights);
    if (newResolution) setResolution(newResolution);
    if (newMachineState) setMachineState(newMachineState);

    const store = useConversationStore.getState();

    if (sawAnyOrderSignal || newCustomerId) {
      const prevCustomer = store.orderWorkflow?.customer ?? null;
      store.setOrderWorkflow({
        customer: newCustomerId
          ? { ...prevCustomer, id: newCustomerId, name: orderCustomerName || prevCustomer?.name }
          : (orderCustomerName ? { ...prevCustomer, name: orderCustomerName } : prevCustomer),
        cart: orderCartValue ?? store.orderWorkflow?.cart ?? null,
        pendingApproval: orderPendingApproval ?? null,
        placedOrder: orderPlaced ?? store.orderWorkflow?.placedOrder ?? null,
      });
    }

    if (sawAnyTicketSignal) {
      store.setTicketWorkflow({
        pendingApproval: ticketPendingApproval ?? null,
        createdTicket: ticketCreated ?? store.ticketWorkflow?.createdTicket ?? null,
      });
    }

    if (sawAnyReturnSignal) {
      store.setReturnWorkflow({
        order: returnOrder ?? store.returnWorkflow?.order ?? null,
        eligibility: returnEligibility ?? store.returnWorkflow?.eligibility ?? null,
        pendingApproval: returnPendingApproval ?? null,
        completed: returnCompleted ?? store.returnWorkflow?.completed ?? null,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isLoading]);

  function handleRefundConfirm(args: RenderRefundActionArgs) {
    const command = `[hidden-action]:${JSON.stringify({ type: "confirm_return", orderId: args.orderId, reason: args.reason, lineItems: args.items })}`;
    sendSuggestion(command);
  }

  function handleDecline() {
    sendSuggestion("Please discard that action — I do not want to proceed.");
  }

  return (
    // minHeight: 0 is required here — this div is a direct CSS Grid item
    // (index.tsx's 3-column grid), and grid items default to min-height:auto,
    // which lets a tall child grow the grid track instead of clipping to it.
    // Without this override, the message list's `overflow-y-auto` below never
    // actually scrolls: the whole grid row just keeps growing as the
    // conversation gets longer, breaking the page layout.
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, backgroundColor: "#ffffff", borderRadius: 0 }}>
      {/* ── Workspace Header ── */}
      <div
        style={{
          height: '56px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {/* Left: Customer name + ticket subject + ticket number + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              fontSize: '15px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {activeTicket
              ? `${acCustomer ? acCustomer + ' — ' : ''}${activeTicket.subject || ''} (#${activeTicket.ticketNumber || activeTicket.id})`
              : sessionCustomerName || 'New conversation'}
          </span>
          {activeTicket?.status && (
            <span style={{
              fontSize: '11px', fontWeight: 700, color: '#4338ca', backgroundColor: '#eef2ff',
              border: '1px solid #e0e7ff', padding: '2px 10px', borderRadius: '9999px',
              textTransform: 'capitalize', letterSpacing: '0.02em', flexShrink: 0,
            }}>
              {activeTicket.status}
            </span>
          )}
          {isLoading && (
            <Badge variant="info" size="sm" className="animate-pulse">
              Thinking…
            </Badge>
          )}
        </div>

        {/* Right: History icon & Toggle Right Panel icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            title="Past conversations"
            onClick={() => {
              setRightPanelOpen(true);
              setRightPanelTab('chatHistory');
            }}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
              color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 106 5.3L3 8" /><path d="M12 7v5l4 2" />
            </svg>
          </button>
          <button
            type="button"
            title={rightPanelOpen ? 'Hide context panel' : 'Show context panel'}
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
              color: rightPanelOpen ? '#4f46e5' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-m-primary/10 flex items-center justify-center mb-4">
              <Icon name="cpu" size="lg" className="text-m-primary" />
            </div>
            <p className="text-sm font-semibold text-m-text mb-1">CSA Assistant</p>
            <p className="text-xs text-m-text-muted max-w-xs">
              Ask me to look up a customer, check an order, manage tickets, or help place an order.
            </p>
          </div>
        )}

        {messages.filter((message) => !isFullyInternalMessage(message)).map((message: UIMessage) => (
          <MessageBubble
            key={message.id}
            message={message}
            onApprove={approveAction}
            onDecline={handleDecline}
            onSuggest={sendSuggestion}
            onRefundConfirm={handleRefundConfirm}
            isLoading={isLoading}
          />
        ))}

        {isLoading && <ThinkingIndicator />}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-m-md bg-m-error-light text-m-error text-xs">
            <Icon name="alert-circle" size="xs" />
            <span>Connection error — please try again.</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-m-border flex-shrink-0 flex flex-col gap-3">
        {/* Quick Actions */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-m-text-muted uppercase tracking-wider">Quick actions</span>
            {messages.length > 0 && (
              <button 
                onClick={() => {
                  (window as any).__csaClearBriefing?.();
                  window.location.reload(); // Simple clear for now
                }}
                className="text-[10px] text-m-text-muted hover:text-m-text flex items-center gap-1 transition-colors"
              >
                <Icon name="rotate-ccw" size="xs" className="w-3 h-3" />
                Clear chat
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              {
                title: 'Create Order',
                steer: acCustomer
                  ? `${acCustomer} is the customer currently in focus — confirm whether this order is for them or someone else before proceeding, then help me find products, add them, and place it.`
                  : 'Ask who the order is for, confirm their details, then help me find products, add them, and place it.',
                icon: 'shopping-cart' as const,
                // Each action gets its own accent — same idea as ActionApproval's
                // per-intent border color — so the quick-actions row reads at a
                // glance instead of six identical gray pills.
                iconClass: 'text-indigo-600',
                hoverClass: 'hover:border-indigo-300 hover:bg-indigo-50',
                onClick: (steer: string) => {
                  setActiveStepper("order");
                  useConversationStore.getState().setOrderWorkflow(null);
                  sendSuggestion(steer);
                }
              },
              {
                title: 'Track Order',
                steer: acOrderRef
                  ? `Order ${acOrderRef} is already in focus — ask me whether I mean that same order or a different one before showing anything.`
                  : acCustomer
                    ? `${acCustomer} is the customer in focus — ask whether I want their orders or a different customer's, then look it up.`
                    : 'Ask me for the order number, email, or customer name, then look it up and show me the details.',
                icon: 'search' as const,
                iconClass: 'text-blue-600',
                hoverClass: 'hover:border-blue-300 hover:bg-blue-50',
                onClick: (steer: string) => sendSuggestion(steer)
              },
              {
                title: 'Look Up Customer',
                steer: acCustomer
                  ? `${acCustomer} is the customer currently in focus — ask whether I mean that customer or a different one, then look them up.`
                  : "Ask me for the customer's name, email, or other details, then search for them and show me the details.",
                icon: 'users' as const,
                iconClass: 'text-violet-600',
                hoverClass: 'hover:border-violet-300 hover:bg-violet-50',
                onClick: (steer: string) => sendSuggestion(steer)
              },
              {
                title: 'Start Return',
                steer: acOrderRef
                  ? `Order ${acOrderRef} is in focus — ask whether it's for that order or a different one, then begin the return for the item(s) being returned.`
                  : acCustomer
                    ? `${acCustomer} is in focus — ask which order first, then begin the return.`
                    : 'Ask me for the order number first, then begin the return process for the item(s) being returned.',
                icon: 'rotate-ccw' as const,
                iconClass: 'text-orange-600',
                hoverClass: 'hover:border-orange-300 hover:bg-orange-50',
                onClick: (steer: string) => {
                  setActiveStepper("return");
                  useConversationStore.getState().setReturnWorkflow(null);
                  sendSuggestion(steer);
                }
              },
              {
                title: 'Process Refund',
                steer: acOrderRef
                  ? `Order ${acOrderRef} is in focus — ask whether the refund is for that order or a different one, then check eligibility and walk me through it.`
                  : acCustomer
                    ? `${acCustomer} is in focus — ask which of their orders, then check eligibility and walk me through it.`
                    : 'Ask me for the order number (or customer email) first, then check refund eligibility and walk me through it.',
                icon: 'dollar-sign' as const,
                iconClass: 'text-teal-600',
                hoverClass: 'hover:border-teal-300 hover:bg-teal-50',
                onClick: (steer: string) => {
                  setActiveStepper("return");
                  useConversationStore.getState().setReturnWorkflow(null);
                  sendSuggestion(steer);
                }
              },
              {
                title: 'Create Ticket',
                steer: acCustomer
                  ? `${acCustomer}${acOrderRef ? ` (order ${acOrderRef})` : ''} is in focus — confirm this is what to escalate, then create a support ticket and hand it off.`
                  : 'Create a support ticket capturing the customer and their issue, then hand it off. Ask me for anything you need to file it.',
                icon: 'ticket' as const,
                iconClass: 'text-rose-600',
                hoverClass: 'hover:border-rose-300 hover:bg-rose-50',
                onClick: (steer: string) => {
                  setActiveStepper("ticket");
                  useConversationStore.getState().setTicketWorkflow(null);
                  sendSuggestion(steer);
                }
              },
            ].map(action => (
              <button
                key={action.title}
                onClick={() => action.onClick(action.steer)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-m-text border border-m-border transition-colors whitespace-nowrap text-xs font-medium shadow-sm hover:shadow-md ${action.hoverClass}`}
              >
                <Icon name={action.icon as any} size="xs" className={action.iconClass} />
                {action.title}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            placeholder="Ask me to draft a reply or check order history..."
            value={input}
            onChange={handleInputChange}
            size="md"
            className="flex-1"
            disabled={isLoading}
          />
          {isLoading ? (
            // While the model is generating, the send button becomes a stop
            // control — previously there was no way to interrupt a reply
            // once it started, even a wrong or runaway one.
            <Button
              type="button"
              variant="secondary"
              size="md"
              iconOnly
              leftIcon={
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              }
              aria-label="Stop generating"
              title="Stop generating"
              onClick={() => stop()}
            />
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="md"
              iconOnly
              leftIcon={<Icon name="send" size="xs" />}
              aria-label="Send"
              disabled={!input.trim()}
            />
          )}
        </form>
      </div>
    </div>
  );
}
