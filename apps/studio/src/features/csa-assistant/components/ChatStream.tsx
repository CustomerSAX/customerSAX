"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { Avatar, Badge, Button, Icon, Input } from "@csa/ui";
import type { UIMessage } from "ai";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActionNotifications } from "../hooks/use-action-notifications";
import { useChatToolEffects } from "../hooks/use-chat-tool-effects";
import type { CsaChat } from "../hooks/use-csa-chat";
import type { VoicePhase } from "../hooks/use-voice-chat";
import { useVoiceChat } from "../hooks/use-voice-chat";
import { useCartStore } from "../store/cart-store";
import { useConversationStore } from "../store/conversation-store";
import type {
  ActionApprovalArgs,
  ApprovalResolution,
  CartSummaryArgs,
  CaseBriefingArgs,
  CrmContactCardArgs,
  DraftEmailArgs,
  OrderConfirmationArgs,
  OrderSummaryArgs,
  ProductCardArgs,
  RenderRefundActionArgs,
  SuggestedActionsArgs,
  TicketCardArgs
} from "../types";
import { ActionApproval } from "./ActionApproval";
import { AssistantIntegrations, type AssistantAttachment } from "./AssistantIntegrations";
import { CheckoutFlow } from "./CheckoutFlow";
import { CrmContactCard, CrmPendingFollowups } from "./CrmCards";
import { Markdown } from "./Markdown";
import { SuggestedActions } from "./SuggestedActions";
import { TicketCard, TicketSummaryTable } from "./TicketCards";
import {
  CartSummaryCard,
  CaseBriefingCard,
  DraftEmailCard,
  OrderConfirmationCard,
  OrderSummaryCard,
  OrderSummaryTable,
  ProductCard,
  RenderRefundCard
} from "./ToolCards";

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
const DECLINE_TEXT = "Please discard that action — I do not want to proceed.";

function messageText(message: UIMessage | undefined): string {
  return (message?.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => (p as { text?: string }).text ?? "")
    .join("\n")
    .trim();
}

/**
 * How the rep answered the approval cards in messages[index], read from the
 * next user message: an Approve/Confirm click, the Decline text, or anything
 * else (they moved on). Null while no later user message exists.
 */
function approvalResolution(messages: UIMessage[], index: number): ApprovalResolution {
  const next = messages.slice(index + 1).find((m) => m.role === "user");
  if (!next) return null;
  const text = messageText(next);
  if (text.startsWith("[approved-action]") || text.includes('"type":"return.confirm"')) return "approved";
  if (text === DECLINE_TEXT) return "declined";
  return "superseded";
}

// Tool cards ToolCallCard (or the product row) actually renders; every other
// tool part is invisible to the rep.
const VISIBLE_TOOLS = new Set([
  "order_summary",
  "order_confirmation",
  "cart_summary",
  "crm_contact_card",
  "ticket_card",
  "case_briefing_card",
  "draft_email",
  "action_approval",
  "suggested_actions",
  "render_refund_action",
  "product_card"
]);

type ToolPart = { type: string; toolName?: string; state?: string; output?: unknown; errorText?: string };

function toolParts(message: UIMessage): Array<ToolPart & { name: string }> {
  return (message.parts ?? []).flatMap((part) => {
    const p = part as ToolPart;
    if (p.type === "dynamic-tool") return [{ ...p, name: p.toolName ?? "" }];
    if (p.type.startsWith("tool-") && p.type !== "tool-invocation") return [{ ...p, name: p.type.slice(5) }];
    return [];
  });
}

function hasVisibleContent(message: UIMessage): boolean {
  const text = (message.parts ?? []).some(
    (p) => p.type === "text" && (p as { text?: string }).text?.trim() && !isInternalMessageText((p as { text: string }).text)
  );
  return (
    text ||
    toolParts(message).some(
      (p) =>
        VISIBLE_TOOLS.has(p.name) ||
        (p.name === "search_tickets" && p.state === "output-available" && Boolean((p.output as { results?: unknown[] } | undefined)?.results?.length)) ||
        ((p.name === "list_products" || p.name === "search_products") && p.state === "output-available" && catalogProductsToCards(p.output).length > 0) ||
        (p.name === "get_crm_contact_details" && p.state === "output-available" && Boolean((p.output as { contact?: { id?: string } } | undefined)?.contact?.id))
    )
  );
}

function isEmptyResult(output: unknown): boolean {
  if (output == null) return true;
  if (Array.isArray(output)) return output.length === 0;
  if (typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  if (o.total === 0) return true;
  return Object.values(o).every((v) => v == null || (Array.isArray(v) && v.length === 0));
}

/**
 * What to tell the rep when the assistant's turn ended with nothing on screen,
 * based only on what its tools actually returned.
 */
function emptyReplyNotice(message: UIMessage): string {
  const lookups = toolParts(message).filter((p) => !VISIBLE_TOOLS.has(p.name) && p.name !== "update_ui_state");
  const failure = lookups.find(
    (p) => p.state === "output-error" || (p.output && typeof p.output === "object" && typeof (p.output as { error?: unknown }).error === "string")
  );
  if (failure) {
    const detail = failure.errorText ?? String((failure.output as { error: string }).error);
    return `This lookup couldn't be completed because a connected system returned an error (${detail.replace(/^Error:\s*/, "").slice(0, 160)}). Please try again.`;
  }
  const finished = lookups.filter((p) => p.state === "output-available");
  if (finished.length > 0 && finished.every((p) => isEmptyResult(p.output))) {
    return "No matching records were found for this request. Check the name, email or number and try again.";
  }
  return "No reply came back for this request. Please try again or rephrase it.";
}

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
  hideHeader?: boolean;
  emptyState?: React.ReactNode;
}

declare global {
  interface Window {
    __csaClearBriefing?: () => void;
  }
}

// ─── Tool card dispatcher ─────────────────────────────────────────────────────

function ToolCallCard({
  toolName,
  args,
  onApprove,
  onDecline,
  onSuggest,
  onRefundConfirm,
  isLoading,
  resolution,
  isLatest
}: {
  toolName: string;
  args: unknown;
  onApprove: (cmd: string) => void;
  onDecline: () => void;
  onSuggest: (prompt: string) => void;
  onRefundConfirm: (args: RenderRefundActionArgs) => void;
  isLoading: boolean;
  resolution: ApprovalResolution;
  isLatest: boolean;
}) {
  // Skip UI-state calls — they're invisible
  if (toolName === "update_ui_state" || toolName === "get_resolution_reasons") return null;

  switch (toolName) {
    case "order_summary":
      return <OrderSummaryCard args={args as OrderSummaryArgs} onSuggest={onSuggest} isLoading={isLoading} />;
    case "order_confirmation":
      return <OrderConfirmationCard args={args as OrderConfirmationArgs} />;
    case "cart_summary":
      return <CartSummaryCard args={args as CartSummaryArgs} />;
    case "crm_contact_card":
      // Pending follow-ups with actions sit in the reply, above the profile card.
      return (
        <>
          <CrmPendingFollowups contactId={(args as CrmContactCardArgs).contactId} onSuggest={onSuggest} />
          <CrmContactCard args={args as CrmContactCardArgs} />
        </>
      );
    case "case_briefing_card":
      return <CaseBriefingCard args={args as CaseBriefingArgs} onSuggest={onSuggest} isLoading={isLoading} />;
    case "ticket_card":
      return <TicketCard args={args as TicketCardArgs} onSuggest={onSuggest} isLoading={isLoading} />;
    case "draft_email":
      return <DraftEmailCard args={args as DraftEmailArgs} />;
    case "action_approval":
      return (
        <ActionApproval
          args={args as ActionApprovalArgs}
          onApprove={onApprove}
          onDecline={onDecline}
          isPending={isLoading}
          resolution={resolution}
          autoFocus={isLatest && !isLoading}
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
          resolution={resolution}
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
  isLoading,
  resolution,
  isLatest,
  prevUserPrompt = "",
}: {
  message: UIMessage;
  onApprove: (cmd: string) => void;
  onDecline: () => void;
  onSuggest: (prompt: string) => void;
  onRefundConfirm: (args: RenderRefundActionArgs) => void;
  isLoading: boolean;
  resolution: ApprovalResolution;
  isLatest: boolean;
  prevUserPrompt?: string;
}) {
  const isUser = message.role === "user";
  const { user } = useCurrentUser();

  // ── Collect product_card parts upfront for horizontal scroll rendering ──
  // They're skipped in the main tool-card loop below and rendered together in
  // a single flex row so all cards appear at the same height, same width.
  // Cards come from two sources: list_products / search_products results (every
  // returned product — so a product list always renders as cards, never
  // depending on the model also calling product_card for each one) and explicit
  // product_card calls. A product already shown from a result isn't repeated.
  const productCards: { args: ProductCardArgs; key: string }[] = [];
  const shownSkus = new Set<string>();
  message.parts?.forEach((part, partIdx) => {
    const p = part as { type: string; toolName?: string; state?: string; input?: unknown; output?: unknown };
    const isStaticTool = p.type.startsWith("tool-") && p.type !== "tool-invocation";
    const isDynamicTool = p.type === "dynamic-tool";
    if (!isStaticTool && !isDynamicTool) return;
    const toolName = isDynamicTool ? (p.toolName ?? "") : p.type.slice(5);
    if ((toolName === "list_products" || toolName === "search_products") && p.state === "output-available") {
      catalogProductsToCards(p.output).forEach((args, i) => {
        if (args.sku) shownSkus.add(args.sku);
        productCards.push({ args, key: `${message.id}-part-${partIdx}-${i}` });
      });
      return;
    }
    if (toolName !== "product_card") return;
    if (p.state !== "output-available" && p.state !== "input-available") return;
    const args = p.input as ProductCardArgs;
    if (args?.sku && shownSkus.has(args.sku)) return;
    productCards.push({ args, key: `${message.id}-part-${partIdx}` });
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

  // Same for tickets: two or more ticket cards become one table.
  const ticketParts = (message.parts ?? []).flatMap((part, partIdx) => {
    const p = part as { type: string; toolName?: string; state?: string; input?: unknown };
    const name = p.type === "dynamic-tool" ? p.toolName : p.type.startsWith("tool-") ? p.type.slice(5) : null;
    if (name !== "ticket_card" || (p.state !== "output-available" && p.state !== "input-available")) return [];
    const id = (p.input as TicketCardArgs | undefined)?.ticketId;
    return id ? [{ partIdx, id }] : [];
  });
  const tableTicketIds = ticketParts.length > 1 ? Array.from(new Set(ticketParts.map((t) => t.id))) : [];

  // CRM details fetched without a contact card (the model skipped the card
  // tool) still show the card and pending follow-ups, from the real result.
  const crmFromDetails = (() => {
    const parts = message.parts ?? [];
    const hasCard = parts.some((part) => {
      const p = part as { type: string; toolName?: string };
      return p.type === "tool-crm_contact_card" || (p.type === "dynamic-tool" && p.toolName === "crm_contact_card");
    });
    if (hasCard) return null;
    const found = parts.flatMap((part, partIdx) => {
      const p = part as { type: string; toolName?: string; state?: string; output?: unknown };
      const name = p.type === "dynamic-tool" ? p.toolName : p.type.startsWith("tool-") ? p.type.slice(5) : null;
      if (name !== "get_crm_contact_details" || p.state !== "output-available") return [];
      const id = (p.output as { contact?: { id?: string } } | undefined)?.contact?.id;
      return id ? [{ partIdx, contactId: id }] : [];
    });
    return found.length ? found[found.length - 1] : null;
  })();

  const userExplicitlyRequestedTable = Boolean(
    prevUserPrompt && /\b(table|grid|tabular|list.*(?:table|all)|display.*(?:table|grid)|view.*in.*table)\b/i.test(prevUserPrompt)
  );

  // A ticket search that found tickets is shown as a table ONLY when the user
  // explicitly requested a table or tabular format. Natural language text is the default.
  const searchTable = (() => {
    if (!userExplicitlyRequestedTable) return null;
    if (ticketParts.length > 0) return null;
    const found = (message.parts ?? []).flatMap((part, partIdx) => {
      const p = part as { type: string; toolName?: string; state?: string; output?: unknown };
      const name = p.type === "dynamic-tool" ? p.toolName : p.type.startsWith("tool-") ? p.type.slice(5) : null;
      if (name !== "search_tickets" || p.state !== "output-available") return [];
      const out = p.output as { results?: Array<{ id?: string }>; total?: number } | undefined;
      const ids = (out?.results ?? []).map((t) => t.id).filter((id): id is string => Boolean(id));
      return ids.length ? [{ partIdx, ids: Array.from(new Set(ids)).slice(0, 10), total: out?.total ?? ids.length }] : [];
    });
    return found.length ? found[found.length - 1] : null;
  })();

  // Two or more orders in one reply read better as a single table than as a
  // stack of tall cards; it renders where the first order card would have.
  const orderParts = (message.parts ?? []).flatMap((part, partIdx) => {
    const p = part as { type: string; toolName?: string; state?: string; input?: unknown };
    const name = p.type === "dynamic-tool" ? p.toolName : p.type.startsWith("tool-") ? p.type.slice(5) : null;
    if (name !== "order_summary" || (p.state !== "output-available" && p.state !== "input-available")) return [];
    return [{ partIdx, args: p.input as OrderSummaryArgs }];
  });
  // The same order shown twice in one reply appears once in the table.
  const tableOrders = orderParts.length > 1
    ? orderParts.filter((o, i) => orderParts.findIndex((x) => x.args.orderId === o.args.orderId) === i).map((o) => o.args)
    : [];

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

      {/* Constrained to 78% (product cards scroll within it); replies with a table take the full chat width so every column fits. */}
      <div
        className={`flex flex-col gap-1 ${!isUser && (tableTicketIds.length > 0 || searchTable || tableOrders.length > 0) ? "min-w-0 flex-1" : "max-w-[78%]"
          } ${isUser ? "items-end" : "items-start"}`}
      >
        {/* Text bubble — in ai@6+, text is in parts, not message.content */}
        {message.parts?.filter(p => p.type === "text").map((p, i) => {
          const textPart = p as { type: "text"; text: string };
          if (!textPart.text || isInternalMessageText(textPart.text)) return null;
          return (
            <div
              key={`text-${i}`}
              className={`rounded-m-lg px-3.5 py-2.5 ${isUser
                  ? "bg-m-primary text-white rounded-tr-sm [&_a]:text-white [&_strong]:text-white"
                  : "bg-m-surface-2 text-m-text rounded-tl-sm"
                }`}
            >
              <Markdown>{textPart.text}</Markdown>
            </div>
          );
        })}

        {/* A finished assistant turn must never be a blank bubble. */}
        {!isUser && !(isLatest && isLoading) && !hasVisibleContent(message) && (
          <div className="rounded-m-lg rounded-tl-sm px-3.5 py-2.5 bg-m-surface-2 text-m-text-muted text-sm flex items-start gap-2">
            <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
            <span>{emptyReplyNotice(message)}</span>
          </div>
        )}

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

          if (toolName === "get_crm_contact_details" && crmFromDetails && partIdx === crmFromDetails.partIdx) {
            return (
              <div key={`${message.id}-crm-details`} className="w-full">
                <CrmPendingFollowups contactId={crmFromDetails.contactId} onSuggest={onSuggest} />
                <CrmContactCard args={{ contactId: crmFromDetails.contactId }} />
              </div>
            );
          }

          if (toolName === "search_tickets" && searchTable && partIdx === searchTable.partIdx) {
            return (
              <TicketSummaryTable
                key={`${message.id}-ticket-search`}
                ticketIds={searchTable.ids}
                total={searchTable.total}
                onSuggest={onSuggest}
                isLoading={isLoading}
              />
            );
          }

          if (toolName === "ticket_card" && tableTicketIds.length > 0) {
            if (partIdx !== ticketParts[0].partIdx) return null;
            return (
              <TicketSummaryTable
                key={`${message.id}-tickets`}
                ticketIds={tableTicketIds}
                onSuggest={onSuggest}
                isLoading={isLoading}
              />
            );
          }

          if (toolName === "order_summary" && tableOrders.length > 0) {
            if (partIdx !== orderParts[0].partIdx) return null;
            return (
              <OrderSummaryTable
                key={`${message.id}-orders`}
                orders={tableOrders}
                onSuggest={onSuggest}
                isLoading={isLoading}
              />
            );
          }

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
              resolution={resolution}
              isLatest={isLatest}
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

// ─── Catalog results → product cards ─────────────────────────────────────────

/**
 * Maps a list_products / search_products result (`{ products: CatalogProduct[] }`,
 * see ai-assist chat/tools/commerce.ts) to product card args. Values pass
 * through unchanged; a missing price or stock stays empty rather than invented.
 */
function catalogProductsToCards(output: unknown): ProductCardArgs[] {
  const products = (output as { products?: unknown } | null)?.products;
  if (!Array.isArray(products)) return [];
  return products.flatMap((raw) => {
    const p = raw as {
      productId?: string; sku?: string | null; variantId?: string; name?: string; description?: string | null;
      category?: string | null; image?: string | null; price?: string | null; stock?: string | null;
    };
    if (!p?.name || !p.sku) return [];
    return [{
      name: p.name,
      sku: p.sku,
      variantId: p.variantId,
      price: p.price ?? "",
      stock: p.stock ?? undefined,
      image: p.image ?? undefined,
      slug: p.productId,
      description: p.description ?? undefined,
      category: p.category ?? undefined,
    }];
  });
}

// ─── Voice mode strip ─────────────────────────────────────────────────────────

const VOICE_PHASE_LABEL: Record<VoicePhase, string> = {
  off: "",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  paused: "Paused — tap to talk"
};

/** Status bar shown above the input while hands-free voice mode is on. */
function VoiceModeStrip({
  phase,
  interim,
  onInterrupt,
  onExit
}: {
  phase: VoicePhase;
  interim: string;
  onInterrupt: () => void;
  onExit: () => void;
}) {
  const active = phase === "listening" || phase === "speaking" || phase === "thinking";
  return (
    <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-m-md bg-m-primary/10 text-sm" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {active && <span className="absolute inline-flex h-full w-full rounded-full bg-m-primary opacity-60 animate-ping motion-reduce:animate-none" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${phase === "listening" ? "bg-m-error" : active ? "bg-m-primary" : "bg-m-text-muted"}`} />
      </span>
      <span className="font-medium text-m-text shrink-0">{VOICE_PHASE_LABEL[phase]}</span>
      <span className="min-w-0 flex-1 truncate text-m-text-muted italic">{phase === "listening" ? interim : ""}</span>
      {phase !== "listening" && (
        <Button type="button" variant="secondary" size="sm" onClick={onInterrupt}>
          {phase === "paused" ? "Talk" : "Interrupt"}
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onExit} aria-label="Turn off voice mode">
        Exit voice
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatStream({ chat, sessionCustomerName, hideHeader, emptyState }: ChatStreamProps) {
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    approveAction,
    sendSuggestion,
    stop
  } = chat;
  const rightPanelOpen = useConversationStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useConversationStore((s) => s.setRightPanelOpen);
  const setRightPanelTab = useConversationStore((s) => s.setRightPanelTab);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const prevMessagesCountRef = useRef(messages.length);
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    isAtBottomRef.current = true;
    setShowScrollBottom(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Consider at bottom if within 80px from the bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isBottom = distanceFromBottom < 80;
    isAtBottomRef.current = isBottom;
    setShowScrollBottom(!isBottom);
  }, []);

  // Smart auto-scroll: only scroll if the user is already at the bottom,
  // or if a brand-new user message was just sent.
  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesCountRef.current;
    prevMessagesCountRef.current = messages.length;

    // If the user just sent a message, always snap to bottom
    const lastMsg = messages[messages.length - 1];
    if (isNewMessage && lastMsg?.role === "user") {
      scrollToBottom("smooth");
      return;
    }

    // While streaming tokens or receiving updates, ONLY scroll if user is already near bottom.
    // Use instant scroll ('auto') during streaming to prevent sluggish animation queues.
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
    }
  }, [messages, isLoading, scrollToBottom]);

  useChatToolEffects(messages, isLoading);
  useActionNotifications(messages, isLoading);

  const locale = useLocale();
  const voice = useVoiceChat({ messages, isLoading, input, setInput, sendText: sendSuggestion, lang: locale });

  function handleRefundConfirm(args: RenderRefundActionArgs) {
    const command = `[hidden-action] ${JSON.stringify({ type: "return.confirm", orderId: args.orderId, reason: args.reason, lineItems: args.items })}`;
    sendSuggestion(command);
  }

  function handleDecline() {
    sendSuggestion(DECLINE_TEXT);
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
      {!hideHeader && (
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
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 && (
            emptyState ?? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-12 h-12 rounded-full bg-m-primary/10 flex items-center justify-center mb-4">
                  <Icon name="cpu" size="lg" className="text-m-primary" />
                </div>
                <p className="text-sm font-semibold text-m-text mb-1">CSA Assistant</p>
                <p className="text-xs text-m-text-muted max-w-xs">
                  Ask me to look up a customer, check an order, manage tickets, or help place an order.
                </p>
              </div>
            )
          )}

          {messages.map((message: UIMessage, index) => {
            if (isFullyInternalMessage(message)) return null;
            const prevUserMessage = messages
              .slice(0, index)
              .reverse()
              .find((m) => m.role === "user");
            const prevUserPrompt =
              prevUserMessage?.parts
                ?.filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join(" ") ?? "";

            return (
              <MessageBubble
                key={message.id}
                message={message}
                onApprove={approveAction}
                onDecline={handleDecline}
                onSuggest={sendSuggestion}
                onRefundConfirm={handleRefundConfirm}
                isLoading={isLoading}
                resolution={message.role === "assistant" ? approvalResolution(messages, index) : null}
                isLatest={index === messages.length - 1}
                prevUserPrompt={prevUserPrompt}
              />
            );
          })}

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

        {/* Floating Scroll to Bottom button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-m-primary text-white text-xs font-medium shadow-md hover:opacity-95 transition-all duration-150 z-20 cursor-pointer"
            aria-label="Scroll to bottom"
          >
            <Icon name="chevron-down" size="xs" />
            <span>Scroll to bottom</span>
          </button>
        )}
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
                  window.__csaClearBriefing?.();
                  window.location.reload(); // Simple clear for now
                }}
                className="text-[10px] text-m-text-muted hover:text-m-text flex items-center gap-1 transition-colors"
              >
                <Icon name="rotate-ccw" size="xs" className="w-3 h-3" />
                Clear chat
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
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
              {
                // After-call work in one approval: ticket note + status + CRM log
                // (+ optional follow-up) — see the WRAP-UP playbook / wrap_up_case.
                title: 'Wrap Up',
                steer: acCustomer
                  ? `Wrap up this case for ${acCustomer}`
                  : 'Wrap up this case',
                icon: 'clipboard-check' as const,
                iconClass: 'text-emerald-600',
                hoverClass: 'hover:border-emerald-300 hover:bg-emerald-50',
                onClick: (steer: string) => sendSuggestion(steer)
              },
            ].map(action => (
              <button
                key={action.title}
                onClick={() => action.onClick(action.steer)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-m-text border border-m-border transition-colors whitespace-nowrap text-xs font-medium shadow-sm hover:shadow-md ${action.hoverClass}`}
              >
                <Icon name={action.icon} size="xs" className={action.iconClass} />
                {action.title}
              </button>
            ))}
          </div>
        </div>

        {voice.voiceMode && (
          <VoiceModeStrip phase={voice.phase} interim={voice.interim} onInterrupt={voice.interrupt} onExit={voice.toggleVoiceMode} />
        )}
        {voice.error && (
          <div role="alert" className="flex items-center gap-2 mb-2 px-3 py-2 rounded-m-md bg-m-error-light text-m-error text-xs">
            <Icon name="mic-off" size="xs" />
            <span className="flex-1">{voice.error}</span>
            <button type="button" onClick={voice.dismissError} className="font-medium underline">Dismiss</button>
          </div>
        )}

        <form onSubmit={(event) => {
          if (attachments.length === 0) { handleSubmit(event); return; }
          event.preventDefault();
          if (!input.trim() || isLoading) return;
          sendSuggestion(input.trim() + attachments.map((file) => `\n\nAttached file: ${file.name}\n${file.text}`).join(""));
          setInput("");
          setAttachments([]);
          scrollToBottom("smooth");
        }} className="flex items-center gap-2">
          <Input
            placeholder={voice.dictating ? "Listening… speak now" : "Ask me to draft a reply or check order history..."}
            value={input}
            onChange={handleInputChange}
            size="md"
            className="min-w-0 flex-1"
            disabled={isLoading}
          />
          {voice.recognitionSupported && !voice.voiceMode && (
            <Button
              type="button"
              variant={voice.dictating ? "danger" : "ghost"}
              size="md"
              iconOnly
              leftIcon={<Icon name={voice.dictating ? "mic-off" : "mic"} size="xs" />}
              aria-label={voice.dictating ? "Stop dictation" : "Dictate a message"}
              aria-pressed={voice.dictating}
              title={voice.dictating ? "Stop dictation" : "Dictate a message"}
              disabled={isLoading}
              onClick={voice.toggleDictation}
            />
          )}
          {voice.recognitionSupported && voice.synthesisSupported && (
            <Button
              type="button"
              variant={voice.voiceMode ? "primary" : "ghost"}
              size="md"
              iconOnly
              leftIcon={<Icon name="audio-lines" size="xs" />}
              aria-label={voice.voiceMode ? "Turn off voice mode" : "Turn on voice mode"}
              aria-pressed={voice.voiceMode}
              title={voice.voiceMode ? "Turn off voice mode" : "Voice mode — talk hands-free, replies are read aloud"}
              onClick={voice.toggleVoiceMode}
            />
          )}
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
        <AssistantIntegrations disabled={isLoading} attachments={attachments} setAttachments={setAttachments} onPrompt={setInput} />
      </div>
    </div>
  );
}
