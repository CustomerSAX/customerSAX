"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Badge, Button, Icon, Input } from "@csa/ui";
import type { UIMessage } from "ai";
import { useCurrentUser } from "@/lib/use-current-user";
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
import { CheckoutFlow } from "./CheckoutFlow";
import { useCartStore } from "../store/cart-store";
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
    // Approval clicks are prefixed so the model knows to proceed, but the
    // approval card in the chat already communicates the intent visually —
    // showing the raw command as a user bubble is technical noise for the rep.
    trimmed.startsWith("[approved-action]") ||
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
  const { user } = useCurrentUser();

  // ── Collect product_card parts upfront for horizontal scroll rendering ──
  // They're skipped in the main tool-card loop below and rendered together in
  // a single flex row so all cards appear at the same height, same width.
  const productCards: { args: ProductCardArgs; key: string }[] = [];
  message.parts?.forEach((part, partIdx) => {
    const p = part as { type: string; toolName?: string; state?: string; input?: unknown };
    const isStaticTool = p.type.startsWith("tool-") && p.type !== "tool-invocation";
    const isDynamicTool = p.type === "dynamic-tool";
    if (!isStaticTool && !isDynamicTool) return;
    const toolName = isDynamicTool ? (p.toolName ?? "") : p.type.slice(5);
    if (toolName !== "product_card") return;
    if (p.state !== "output-available" && p.state !== "input-available") return;
    productCards.push({ args: p.input as ProductCardArgs, key: `${message.id}-part-${partIdx}` });
  });

  // Route through the AI's order.add_item action so the real cart flow
  // (customer resolution → add_to_cart tool → BFF → commercetools) runs.
  // No direct endpoint call from the card; the AI owns the cart.
  function handleAddToCart(cardArgs: ProductCardArgs) {
    onSuggest(
      `[hidden-action] ${JSON.stringify({
        type: "order.add_item",
        sku: cardArgs.sku,
        name: cardArgs.name,
        quantity: 1,
      })}`
    );
  }

  const hasProductCards = productCards.length > 0;

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
          <Avatar name={user?.name || "AG"} size="sm" />
        </div>
      )}

      {/* Always constrain to 78% — the horizontal scroll row scrolls within that width */}
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

        {/* Tool cards — product_card parts are skipped here and rendered in the
            horizontal scroll row below so all cards appear at a consistent size. */}
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

          // Handled in the horizontal scroll row below
          if (toolName === "product_card") return null;

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

        {/* ── Horizontal product card scroll row with ← → arrows ── */}
        {hasProductCards && (
          <ProductCardScrollRow>
            {productCards.map(({ args, key }) => (
              <ProductCard
                key={key}
                args={args}
                onAddToCart={handleAddToCart}
              />
            ))}
          </ProductCardScrollRow>
        )}
      </div>
    </div>
  );
}

// ─── Horizontal scroll row with left/right arrow buttons ─────────────────────
// The scroll container is position:relative so the absolutely-positioned arrow
// buttons overlay it without shifting the cards. Arrows appear only when the
// row is actually wider than its visible area (canScrollLeft/canScrollRight).

function ProductCardScrollRow({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect(); };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const arrowBase: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    zIndex: 10, width: 28, height: 28, borderRadius: '50%',
    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-1)',
    boxShadow: 'var(--shadow-md)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'opacity 0.15s, transform 0.15s',
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {canLeft && (
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          style={{ ...arrowBase, left: -12 }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(-50%) scale(1)')}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', paddingBottom: 8, paddingTop: 4 }}
        className="scrollbar-hide"
      >
        <div className="flex gap-3">
          {children}
        </div>
      </div>
      {canRight && (
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          style={{ ...arrowBase, right: -12 }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(-50%) scale(1)')}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
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

  const cartItems = useCartStore((s) => s.items);
  const cartTotalLabel = useCartStore((s) => s.totalLabel);
  const cartItemCount = cartItems.reduce((n, i) => n + (i.quantity || 0), 0);
  const openCart = useCartStore((s) => s.openCart);

  // Read the order workflow so we can gate the cart pill:
  //  - CartProvider silently loads any pre-existing CT cart for the customer,
  //    so cartItemCount > 0 doesn't mean "actively building an order".
  //  - Only show the pill when the AI has produced a cart_summary (orderWorkflow.cart
  //    is set) AND the order has not yet been placed (no placedOrder).
  const orderWorkflow = useConversationStore((s) => s.orderWorkflow);
  const showCartPill = cartItemCount > 0
    && orderWorkflow?.cart != null
    && !orderWorkflow?.placedOrder;

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
    let newCustomerEmail: string | undefined;
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
            // Map every Zod workflowStage value to a clean display label.
            // Unknown/legacy values fall back to uppercased snake_case → spaces.
            const stageMap: Record<string, string> = {
              greeting:             "GREETING",
              identifying_customer: "IDENTIFYING CUSTOMER",
              reading_order:        "READING ORDER",
              reading_ticket:       "READING TICKET",
              reading_cart:         "READING CART",
              reading_product:      "READING PRODUCT",
              composing_action:     "COMPOSING",
              awaiting_approval:    "AWAITING APPROVAL",
              executing_action:     "EXECUTING",
              summarizing:          "SUMMARIZING",
              drafting_email:       "DRAFTING EMAIL",
              knowledge_lookup:     "KNOWLEDGE LOOKUP",
              closing:              "CLOSING",
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
        // No !newCustomerId guard — if the conversation has multiple customer
        // lookups (e.g., first John Doe then Shivam Soni) the last one wins,
        // because we iterate oldest→newest and the most recent find_customer
        // result should be the active customer. update_ui_state's customerId
        // (processed earlier in the same loop iteration) always takes priority
        // because it arrives *after* find_customer in the same assistant turn.
        if (toolName === 'find_customer' && p.output) {
          const result = unwrapMcpResult(p.output);
          const first = result?.customers?.[0] ?? (result?.id ? result : null);
          if (first?.id) {
            newCustomerId = String(first.id);
            orderCustomerName = [first.firstName, first.lastName].filter(Boolean).join(' ') || first.email || undefined;
            if (first.email) newCustomerEmail = String(first.email);
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
            items: (args.items || []).map((it: any) => ({ sku: it.sku, name: it.name, price: it.lineTotal ?? it.price, quantity: it.quantity ?? it.qty })),
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
            returnEligibility = { eligible: result.eligible, reason: result.eligible ? undefined : (result.reason ?? (Array.isArray(result.reasons) ? result.reasons.join(' ') : undefined)) };
            if (result.order) {
              returnOrder = {
                id: result.order.id,
                orderNumber: result.order.orderNumber,
                total: result.order.totalPrice,
                lineItems: Array.isArray(result.order.lineItems) ? result.order.lineItems.map((li: any) => ({ lineItemId: li.lineItemId, name: li.name, quantity: li.quantity, price: li.price })) : []
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

      // Once the order is confirmed, clear the cart store — the rep is done with
      // this session's cart and the pill must not linger into the next conversation.
      // orderPlaced is only non-null when order_confirmation fired this turn.
      if (orderPlaced && !store.orderWorkflow?.placedOrder) {
        useCartStore.getState().clear();
      }
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

    // Right-panel Customer card — previously only populated when a customer
    // was picked from the sidebar list (ConversationList's handleSelectCustomer
    // calls setContextHydrated there). A customer identified purely through
    // free-form chat (find_customer / update_ui_state's customerId) never
    // reached this field, so the panel kept saying "No customer identified
    // yet." even once the chat had already found and displayed them. Only
    // fires once per newly-identified id — re-running this effect on every
    // message doesn't re-fetch for a customer already in the panel.
    if (newCustomerId && newCustomerId !== store.customer?.id) {
      const interimName = orderCustomerName || newCustomerEmail || 'Customer';
      store.setContextHydrated("Customer", {
        id: newCustomerId,
        name: interimName,
        email: newCustomerEmail,
        status: "Active",
      });

      fetch(`/api/context/resolve?customerId=${encodeURIComponent(newCustomerId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const resolved = data?.customer;
          if (!resolved) return;
          // Guard against a stale response landing after the rep has moved
          // on to a different customer in the meantime.
          if (useConversationStore.getState().customer?.id !== newCustomerId) return;
          store.setContextHydrated("Customer", {
            id: resolved.id ?? newCustomerId,
            name: resolved.name || interimName,
            email: resolved.email || newCustomerEmail,
            status: resolved.tier || "Active",
            createdAt: resolved.createdAt ?? undefined,
            orderCount: resolved.orderCount ?? undefined,
            lifetimeValue: resolved.lifetimeValue ?? undefined,
          });
        })
        .catch((e) => console.error('Failed to resolve customer context:', e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isLoading]);

  function handleRefundConfirm(args: RenderRefundActionArgs) {
    const command = `[hidden-action] ${JSON.stringify({ type: "return.confirm", orderId: args.orderId, reason: args.reason, lineItems: args.items })}`;
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, backgroundColor: "var(--color-surface-1)", borderRadius: 0 }}>
      {/* ── Workspace Header ── */}
      <div
        style={{
          height: '56px',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        {/* Left: Customer name + ticket subject + ticket number + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              fontSize: '15px', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {activeTicket
              ? `${acCustomer ? acCustomer + ' — ' : ''}${activeTicket.subject || ''} (#${activeTicket.ticketNumber || activeTicket.id})`
              : sessionCustomerName || 'New conversation'}
          </span>
          {activeTicket?.status && (
            <span style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary-border)', padding: '2px 10px', borderRadius: '9999px',
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

        {/* Right: Cart pill + History icon & Toggle Right Panel icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {showCartPill && (
            <button
              type="button"
              title="View the order you're building"
              onClick={openCart}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '5px 12px 5px 10px', borderRadius: '9999px',
                border: '1px solid var(--color-primary-border)', background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.14s ease, border-color 0.14s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-border)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <span>{cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}</span>
              {cartTotalLabel && <span style={{ opacity: 0.7 }}>·</span>}
              {cartTotalLabel && <span>{cartTotalLabel}</span>}
            </button>
          )}
          <button
            type="button"
            title="Past conversations"
            onClick={() => {
              setRightPanelOpen(true);
              setRightPanelTab('chatHistory');
            }}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
              color: 'var(--color-text-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-3)')}
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
              color: rightPanelOpen ? 'var(--color-primary)' : 'var(--color-text-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-3)')}
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

        {/* Checkout flow — rendered inline inside the chat scroll list */}
        <CheckoutFlow
          onViewOrder={(orderNumber) => {
            sendSuggestion(`[hidden-action] ${JSON.stringify({ type: 'order.view', orderNumber })}`);
          }}
        />

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
                  ? `Create a new order for ${acCustomer}`
                  : 'Create a new order',
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
                  ? `Track order ${acOrderRef}`
                  : acCustomer
                    ? `Track orders for ${acCustomer}`
                    : 'Track an order',
                icon: 'search' as const,
                iconClass: 'text-blue-600',
                hoverClass: 'hover:border-blue-300 hover:bg-blue-50',
                onClick: (steer: string) => sendSuggestion(steer)
              },
              {
                title: 'Look Up Customer',
                steer: acCustomer
                  ? `Look up ${acCustomer}`
                  : 'Look up a customer',
                icon: 'users' as const,
                iconClass: 'text-violet-600',
                hoverClass: 'hover:border-violet-300 hover:bg-violet-50',
                onClick: (steer: string) => sendSuggestion(steer)
              },
              {
                title: 'Start Return',
                steer: acOrderRef
                  ? `Start a return for order ${acOrderRef}`
                  : acCustomer
                    ? `Start a return for ${acCustomer}`
                    : 'Start a return',
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
                  ? `Process a refund for order ${acOrderRef}`
                  : acCustomer
                    ? `Process a refund for ${acCustomer}`
                    : 'Process a refund',
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
                  ? `Create a support ticket for ${acCustomer}${acOrderRef ? ` — order ${acOrderRef}` : ''}`
                  : 'Create a support ticket',
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
