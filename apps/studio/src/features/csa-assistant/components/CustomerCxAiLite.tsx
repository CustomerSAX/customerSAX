"use client";

import { stripLocalePrefix } from "@/i18n/routing";
import { roleLabel, useCurrentUser } from "@/lib/use-current-user";
import type { UIMessage } from "ai";
import {
  AlertCircle,
  ChevronDown,
  Compass,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Package,
  RotateCcw,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Square,
  Ticket,
  User,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageContext } from "../context/page-context";
import { useCsaChat } from "../hooks/use-csa-chat";
import { useVoiceChat } from "../hooks/use-voice-chat";
import type {
  ActionApprovalArgs,
  BusinessType,
  CartSummaryArgs,
  CaseBriefingArgs,
  CrmContactCardArgs,
  DraftEmailArgs,
  OrderConfirmationArgs,
  OrderSummaryArgs,
  ProductCardArgs,
  RenderRefundActionArgs,
  SessionContext,
  SuggestedActionsArgs,
  TicketCardArgs,
} from "../types";
import { ActionApproval } from "./ActionApproval";
import { Markdown } from "./Markdown";
import { SuggestedActions } from "./SuggestedActions";
import { TicketCard } from "./TicketCards";
import { CrmContactCard, CrmPendingFollowups } from "./CrmCards";
import {
  CartSummaryCard,
  CaseBriefingCard,
  DraftEmailCard,
  OrderConfirmationCard,
  OrderSummaryCard,
  ProductCard,
  RenderRefundCard,
} from "./ToolCards";

const rawBusinessType = process.env.NEXT_PUBLIC_CT_BUSINESS_TYPE;
const CT_BUSINESS_TYPE: BusinessType | undefined =
  rawBusinessType === "b2b" || rawBusinessType === "b2c" ? rawBusinessType : undefined;

const VIP_THRESHOLD = process.env.NEXT_PUBLIC_CSA_VIP_THRESHOLD || undefined;
const STORAGE_OPEN_KEY = "csa-ai-lite-expanded";
const STORAGE_MODE_KEY = "csa-ai-lite-mode";

type AiLiteMode = "compact" | "expanded";

function isInternalMessageText(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith("[hidden-action]") ||
    trimmed.startsWith("[approved-action]") ||
    trimmed.startsWith("I just opened this ticket.") ||
    /^\s*functions\.\w+\s*\(/.test(trimmed) ||
    /^\s*\{[\s\S]*"(cartId|orderId|sku|productId|customerId)"/.test(trimmed)
  );
}

function ContextIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  switch (icon) {
    case "shopping-bag":
      return <ShoppingBag size={size} />;
    case "user":
    case "users":
      return <User size={size} />;
    case "ticket":
      return <Ticket size={size} />;
    case "package":
      return <Package size={size} />;
    case "shopping-cart":
      return <ShoppingCart size={size} />;
    default:
      return <Compass size={size} />;
  }
}

export function CustomerCxAiLite() {
  const pathname = usePathname() || "/";
  const cleanPath = stripLocalePrefix(pathname);

  // Hidden on dedicated assistant full page and login/auth screens
  const isExcludedPage =
    cleanPath === "/csa-assistant" ||
    cleanPath.startsWith("/csa-assistant/") ||
    cleanPath === "/agent-mode" ||
    cleanPath.startsWith("/agent-mode/") ||
    cleanPath.startsWith("/login") ||
    cleanPath.startsWith("/sign-in") ||
    cleanPath.startsWith("/auth");

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_OPEN_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [mode, setMode] = useState<AiLiteMode>(() => {
    if (typeof window === "undefined") return "compact";
    try {
      const saved = localStorage.getItem(STORAGE_MODE_KEY);
      return saved === "expanded" ? "expanded" : "compact";
    } catch {
      return "compact";
    }
  });

  const handleSetMode = useCallback((nextMode: AiLiteMode) => {
    setMode(nextMode);
    try {
      localStorage.setItem(STORAGE_MODE_KEY, nextMode);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    handleSetMode(mode === "compact" ? "expanded" : "compact");
  }, [mode, handleSetMode]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_OPEN_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_OPEN_KEY, "false");
    } catch {
      /* ignore */
    }
  }, []);

  // Real logged-in identity & permissions
  const { user } = useCurrentUser();
  const isWriter = user?.role === "agent" || user?.role === "admin" || user?.role === "superadmin";

  // Real-time structured page context
  const { context, contextPill, suggestedPrompts } = usePageContext();

  const sessionContext = useMemo<SessionContext>(() => {
    return {
      userEmail: user?.email,
      userRole: user ? roleLabel(user.role) : undefined,
      projectKey: user?.activeProjectKey,
      clientId: user?.activeClientId,
      businessType: CT_BUSINESS_TYPE,
      pageContext: context,
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
  }, [user, isWriter, context]);

  const chat = useCsaChat(sessionContext);
  const {
    messages,
    error,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    approveAction,
    sendSuggestion,
    clearSession,
    setMessages,
  } = chat;

  // Browser-native voice dictation integration
  const voice = useVoiceChat({
    messages,
    isLoading,
    input,
    setInput,
    sendText: sendSuggestion,
    lang: "en-US",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input on expand
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleResetConversation = useCallback(() => {
    clearSession();
    setMessages([]);
  }, [clearSession, setMessages]);

  const handleQuickPromptClick = useCallback(
    (promptText: string) => {
      // Auto-expand workspace for complex deep analysis workflows
      if (
        promptText.startsWith("⚡") ||
        promptText.toLowerCase().includes("analyze") ||
        promptText.toLowerCase().includes("review")
      ) {
        handleSetMode("expanded");
      }
      const cleanPrompt = promptText.replace(/^⚡\s*/, "");
      sendSuggestion(cleanPrompt);
    },
    [sendSuggestion, handleSetMode]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      chat.handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  if (isExcludedPage) {
    return null;
  }

  const isExpandedMode = mode === "expanded";

  const containerClassName = isExpandedMode
    ? "fixed inset-y-0 right-0 z-[200] flex pointer-events-none justify-end"
    : "fixed bottom-4 right-4 z-[200] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6 pointer-events-none";

  const windowClassName = isExpandedMode
    ? "pointer-events-auto flex h-[100dvh] w-full sm:w-[min(760px,50vw)] flex-col overflow-hidden border-l border-m-border bg-m-surface text-m-text shadow-2xl backdrop-blur-md transition-all duration-300"
    : "pointer-events-auto flex h-[min(640px,calc(100dvh-88px))] w-[calc(100vw-32px)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-m-border bg-m-surface text-m-text shadow-[0_20px_50px_rgba(15,23,42,0.22)] backdrop-blur-md transition-all duration-300";

  return (
    <aside aria-label="Customer CX AI" className={containerClassName}>
      {/* ── Collapsed Launcher Button ──────────────────────────────────── */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleToggle}
          title="Open Customer CX AI"
          aria-label="Open Customer CX AI"
          className="pointer-events-auto group relative flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-4 py-3 text-white shadow-[0_8px_30px_rgb(0,0,0,0.18)] transition-all duration-300 hover:scale-105 hover:shadow-[0_12px_36px_rgb(37,99,235,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-transform duration-300 group-hover:rotate-12">
            <Sparkles size={18} />
          </span>
          <div className="flex flex-col items-start pr-1 text-left">
            <span className="text-xs font-semibold leading-tight tracking-tight">AI Assist</span>
            <span className="text-[10px] text-blue-100/90 leading-tight flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {contextPill.label.length > 20 ? `${contextPill.label.slice(0, 20)}...` : contextPill.label}
            </span>
          </div>
        </button>
      )}

      {/* ── AI Assistant Window (Shared instance between compact popover & workspace drawer) ── */}
      {isOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={isExpandedMode ? "Customer CX AI Assist Workspace" : "Customer CX AI Assist Conversation"}
          className={windowClassName}
        >
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-m-border bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold leading-tight text-white truncate">
                    {isExpandedMode ? "Customer CX AI — Workspace" : "Customer CX AI Assist"}
                  </h2>
                </div>
                <p className="text-[11px] text-blue-100 truncate flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Context-aware assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetConversation}
                title="Start a new conversation"
                aria-label="Start a new conversation"
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                onClick={toggleMode}
                title={isExpandedMode ? "Collapse to compact view" : "Expand to workspace drawer"}
                aria-label={isExpandedMode ? "Collapse to compact view" : "Expand to workspace drawer"}
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                {isExpandedMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={handleClose}
                title="Minimize assistant"
                aria-label="Minimize assistant"
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </header>

          {/* Active Page Context Indicator */}
          <div className="flex shrink-0 items-center justify-between border-b border-m-border bg-m-surface-2 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-700">
                <ContextIcon icon={contextPill.icon} size={12} />
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-m-text truncate max-w-[200px]" title={contextPill.label}>
                  {contextPill.label}
                </span>
                {contextPill.detail && (
                  <span className="text-[11px] text-m-text-muted truncate max-w-[120px]">
                    · {contextPill.detail}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isExpandedMode && (
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-500/20">
                  Workspace
                </span>
              )}
              <span
                className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 border border-emerald-500/20"
                title="Assistant automatically uses current screen details"
              >
                Live Context
              </span>
            </div>
          </div>

          {/* Scrollable Conversation Pane */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 bg-m-surface">
            {/* Empty State / Welcome Greeting */}
            {messages.length === 0 && (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-m-border bg-m-surface-2 p-3.5 text-xs leading-relaxed text-m-text space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-m-text">
                    <Sparkles size={14} className="text-blue-600" />
                    How can I help you right now?
                  </div>
                  <p className="text-m-text-muted">
                    I automatically understand that you are on{" "}
                    <strong className="text-m-text">{contextPill.label}</strong>. You don&apos;t need to
                    re-type order numbers, ticket IDs, or customer names.
                  </p>
                </div>

                {/* Suggested prompt chips */}
                {suggestedPrompts.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-m-text-muted">
                      Suggested Actions
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {suggestedPrompts.map((promptText, i) => {
                        const isDeep =
                          promptText.startsWith("⚡") || promptText.toLowerCase().includes("analyze");
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleQuickPromptClick(promptText)}
                            disabled={isLoading}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-50 ${isDeep
                                ? "border-blue-300 bg-blue-50/70 text-blue-800 hover:border-blue-500 hover:bg-blue-100/70 font-medium"
                                : "border-m-border bg-m-surface text-m-text hover:border-blue-500 hover:bg-blue-50/50 hover:text-blue-700"
                              }`}
                          >
                            <span className="truncate pr-2">{promptText}</span>
                            <Send size={11} className="shrink-0 text-m-text-muted" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((message: UIMessage) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                >
                  {/* Text parts */}
                  {message.parts
                    ?.filter((p) => p.type === "text")
                    .map((p, idx) => {
                      const textPart = p as { type: "text"; text: string };
                      if (!textPart.text || isInternalMessageText(textPart.text)) return null;

                      return (
                        <div
                          key={`text-${idx}`}
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm break-words ${isUser
                              ? "rounded-tr-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                              : "rounded-tl-sm bg-m-surface-2 text-m-text border border-m-border/60"
                            }`}
                        >
                          <Markdown>{textPart.text}</Markdown>
                        </div>
                      );
                    })}

                  {/* Tool Call Cards */}
                  {!isUser &&
                    message.parts?.map((part, partIdx) => {
                      const p = part as {
                        type: string;
                        toolName?: string;
                        state?: string;
                        input?: unknown;
                      };
                      const isStaticTool =
                        p.type.startsWith("tool-") && p.type !== "tool-invocation";
                      const isDynamicTool = p.type === "dynamic-tool";
                      if (!isStaticTool && !isDynamicTool) return null;

                      const toolName = isDynamicTool ? p.toolName ?? "" : p.type.slice(5);
                      if (p.state !== "output-available" && p.state !== "input-available") return null;
                      if (toolName === "update_ui_state" || toolName === "get_resolution_reasons")
                        return null;

                      return (
                        <div key={`${message.id}-tool-${partIdx}`} className="w-full max-w-[95%] my-1">
                          {toolName === "action_approval" && (
                            <ActionApproval
                              args={p.input as ActionApprovalArgs}
                              onApprove={approveAction}
                              onDecline={() => sendSuggestion("I decline this action.")}
                              isPending={isLoading}
                            />
                          )}
                          {toolName === "order_summary" && (
                            <OrderSummaryCard
                              args={p.input as OrderSummaryArgs}
                              onSuggest={sendSuggestion}
                              isLoading={isLoading}
                            />
                          )}
                          {toolName === "order_confirmation" && (
                            <OrderConfirmationCard args={p.input as OrderConfirmationArgs} />
                          )}
                          {toolName === "cart_summary" && (
                            <CartSummaryCard args={p.input as CartSummaryArgs} />
                          )}
                          {toolName === "case_briefing_card" && (
                            <CaseBriefingCard args={p.input as CaseBriefingArgs} />
                          )}
                          {toolName === "ticket_card" && (
                            <TicketCard
                              args={p.input as TicketCardArgs}
                              onSuggest={sendSuggestion}
                              isLoading={isLoading}
                            />
                          )}
                          {toolName === "crm_contact_card" && (
                            <div className="space-y-2">
                              <CrmPendingFollowups
                                contactId={(p.input as CrmContactCardArgs).contactId}
                                onSuggest={sendSuggestion}
                              />
                              <CrmContactCard args={p.input as CrmContactCardArgs} />
                            </div>
                          )}
                          {toolName === "draft_email" && (
                            <DraftEmailCard args={p.input as DraftEmailArgs} />
                          )}
                          {toolName === "suggested_actions" && (
                            <SuggestedActions
                              args={p.input as SuggestedActionsArgs}
                              onSelect={sendSuggestion}
                              disabled={isLoading}
                            />
                          )}
                          {toolName === "render_refund_action" && (
                            <RenderRefundCard
                              args={p.input as RenderRefundActionArgs}
                              onConfirm={() => approveAction("Confirm refund")}
                              onDecline={() => sendSuggestion("Cancel refund")}
                              isPending={isLoading}
                            />
                          )}
                          {toolName === "product_card" && (
                            <ProductCard
                              args={p.input as ProductCardArgs}
                              onAddToCart={(item) =>
                                sendSuggestion(
                                  `[hidden-action] ${JSON.stringify({
                                    type: "order.add_item",
                                    sku: item.sku,
                                    name: item.name,
                                    quantity: 1,
                                  })}`
                                )
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {/* Streaming / Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 rounded-xl bg-m-surface-2 px-3 py-2 text-xs text-m-text-muted w-fit border border-m-border/40">
                <span className="flex gap-1 items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                </span>
                <span className="text-[11px]">Thinking & fetching data...</span>
              </div>
            )}

            {/* Error Message & Retry */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">Assistant temporarily unavailable</p>
                  <p className="text-[11px] text-red-700 leading-tight">
                    Could not complete the request. Please verify your connection or try again.
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input & Action Bar */}
          <footer className="border-t border-m-border bg-m-surface-2 p-2.5 space-y-2">
            {/* Dictating / Voice Status preview */}
            {voice.dictating && (
              <div className="flex items-center justify-between px-2.5 py-1.5 text-xs bg-red-500/10 text-red-700 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                  <span className="font-medium">Listening... speak now</span>
                </div>
                <button
                  type="button"
                  onClick={voice.toggleDictation}
                  className="text-[11px] font-semibold text-red-700 hover:underline"
                >
                  Done
                </button>
              </div>
            )}

            {voice.error && (
              <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] bg-red-50 text-red-700 rounded-lg border border-red-200">
                <span className="truncate">{voice.error}</span>
                <button
                  type="button"
                  onClick={voice.dismissError}
                  className="ml-2 font-semibold hover:underline"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <div className="relative flex items-center rounded-xl border border-m-border bg-m-surface focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask about ${contextPill.label.toLowerCase()}...`}
                  rows={1}
                  disabled={isLoading}
                  className="w-full resize-none bg-transparent px-3 py-2 text-xs text-m-text placeholder:text-m-text-muted outline-none disabled:opacity-60 max-h-24 min-h-[36px]"
                />

                <div className="flex items-center pr-1.5 gap-1">
                  {voice.recognitionSupported && (
                    <button
                      type="button"
                      onClick={voice.toggleDictation}
                      disabled={isLoading}
                      title={voice.dictating ? "Stop voice dictation" : "Voice dictation (speech-to-text)"}
                      aria-label={voice.dictating ? "Stop voice dictation" : "Voice dictation"}
                      className={`rounded-lg p-1.5 transition ${voice.dictating
                          ? "bg-red-500/15 text-red-600 animate-pulse"
                          : "text-m-text-muted hover:bg-m-surface-2 hover:text-m-text"
                        }`}
                    >
                      {voice.dictating ? <MicOff size={15} /> : <Mic size={15} />}
                    </button>
                  )}

                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stop}
                      title="Stop generating"
                      className="rounded-lg p-1.5 text-m-text-muted hover:bg-m-surface-2 hover:text-red-600 transition"
                    >
                      <Square size={14} className="fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      title="Send message"
                      className="rounded-lg p-1.5 text-blue-600 transition hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Send size={15} />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </footer>
        </section>
      )}
    </aside>
  );
}
