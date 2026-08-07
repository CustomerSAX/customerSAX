"use client";

import { useEffect, useRef } from "react";
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon, Input } from "@csa/ui";
import type { UIMessage } from "ai";
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
import type { CsaChat } from "../hooks/use-csa-chat";

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
          if (!textPart.text) return null;
          return (
            <div
              key={`text-${i}`}
              className={`rounded-m-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                isUser
                  ? "bg-m-primary text-white rounded-tr-sm"
                  : "bg-m-surface-2 text-m-text rounded-tl-sm"
              }`}
            >
              {textPart.text}
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
    sendSuggestion
  } = chat;

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleRefundConfirm(args: RenderRefundActionArgs) {
    const command = `[hidden-action]:${JSON.stringify({ type: "confirm_return", orderId: args.orderId, reason: args.reason, lineItems: args.items })}`;
    sendSuggestion(command);
  }

  function handleDecline() {
    sendSuggestion("Please discard that action — I do not want to proceed.");
  }

  return (
    <Card variant="default" className="flex flex-col h-full">
      <CardHeader className="px-4 py-3 border-b border-m-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="message-square" size="sm" className="text-m-primary" />
            <CardTitle className="text-xs font-semibold text-m-text">
              {sessionCustomerName ? `Session — ${sessionCustomerName}` : "Agent Workspace"}
            </CardTitle>
          </div>
          {isLoading && (
            <Badge variant="info" size="sm" className="animate-pulse">
              Thinking…
            </Badge>
          )}
          {error && (
            <Badge variant="error" size="sm">
              Error
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {messages.map((message: UIMessage) => (
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
      </CardContent>

      {/* Input */}
      <div className="px-4 py-3 border-t border-m-border flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            placeholder="Ask CSA Assistant — look up a customer, order, ticket…"
            value={input}
            onChange={handleInputChange}
            size="md"
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            iconOnly
            leftIcon={<Icon name="send" size="xs" />}
            aria-label="Send"
            disabled={isLoading || !input.trim()}
          />
        </form>
      </div>
    </Card>
  );
}
