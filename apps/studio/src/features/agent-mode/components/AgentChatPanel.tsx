"use client";

import { useState, useCallback, useMemo } from "react";
import { Icon, Button } from "@csa/ui";
import { ChatStream } from "@/features/csa-assistant/components/ChatStream";
import type { CsaChat } from "@/features/csa-assistant/hooks/use-csa-chat";
import { useCurrentUser } from "@/lib/use-current-user";
import { useConversationStore } from "@/features/csa-assistant/store/conversation-store";
import {
  buildStartMyDayBriefing,
  getTimeAppropriateGreeting,
  isStartMyDayIntent,
  resolveFollowUpReference,
} from "../api/start-my-day";
import type { AgentTask } from "../types";

interface AgentChatPanelProps {
  chat: CsaChat;
  selectedTask: AgentTask | null;
  onSelectTask: (task: AgentTask | null) => void;
  onClearSession: () => void;
  allTasks?: AgentTask[];
  onOpenWorkspace?: () => void;
}

export function AgentChatPanel({
  chat,
  selectedTask,
  onSelectTask,
  onClearSession,
  allTasks = [],
  onOpenWorkspace,
}: AgentChatPanelProps) {
  const { user } = useCurrentUser();
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingTasks, setBriefingTasks] = useState<AgentTask[]>([]);

  const greeting = useMemo(() => {
    return getTimeAppropriateGreeting(new Date());
  }, []);

  const agentDisplayName = user?.name?.split(" ")[0] || "Agent";

  // ── 1. Unified Start My Day Execution ──────────────────────────────────────
  // Works identically whether triggered from welcome pill, typed into fresh chat,
  // typed mid-conversation, or refreshed.
  const handleExecuteStartMyDay = useCallback(
    async (userPromptText?: string) => {
      setBriefingLoading(true);
      try {
        let candidateTasks = allTasks;

        // Fetch live open tickets directly if candidateTasks is empty
        if (candidateTasks.length === 0) {
          try {
            const res = await fetch("/api/tickets?status=open&limit=20");
            if (res.ok) {
              const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
              candidateTasks = (data.results ?? []).map((t) => ({
                id: String(t.id ?? ""),
                type: "ticket",
                referenceNumber: String(t.ticketNumber ?? String(t.id).slice(0, 8)),
                title: String(t.subject ?? "Customer Inquiry"),
                customerName: String(t.customerName ?? t.customerEmail ?? "Customer"),
                customerEmail: t.customerEmail ? String(t.customerEmail) : undefined,
                status: String(t.status ?? "open"),
                priority: (String(t.priority ?? "normal").toLowerCase()) as AgentTask["priority"],
                urgencyReason: String(t.priority ?? "").toLowerCase() === "urgent" ? "Urgent Priority" : "Open Ticket",
                orderNumber: t.orderNumber ? String(t.orderNumber) : undefined,
                createdAt: t.createdAt ? String(t.createdAt) : undefined,
                rawRecord: t,
              }));
            }
          } catch {
            // Best-effort live fetch fallback
          }
        }

        const briefing = buildStartMyDayBriefing(candidateTasks, user?.name, new Date());
        setBriefingTasks(briefing.rankedItems);

        // Send natural user instruction to the AI assistant
        const promptToSend = userPromptText?.trim() || "Start My Day";
        chat.sendSuggestion(promptToSend);
      } finally {
        setBriefingLoading(false);
      }
    },
    [allTasks, chat, user?.name]
  );

  // ── 2. Intercept conversational suggestion / follow-up ────────────────────
  const handleSuggestionClick = useCallback(
    (promptText: string) => {
      if (isStartMyDayIntent(promptText)) {
        void handleExecuteStartMyDay(promptText);
        return;
      }

      // Check if prompt refers to an item from the briefing
      const target = resolveFollowUpReference(promptText, briefingTasks.length > 0 ? briefingTasks : allTasks);
      if (target) {
        onSelectTask(target);
        if (target.type === "ticket") {
          useConversationStore.getState().setActiveTicketId(target.id);
        }
      }
      chat.sendSuggestion(promptText);
    },
    [allTasks, briefingTasks, chat, handleExecuteStartMyDay, onSelectTask]
  );

  // ── 3. Wrapped chat interface that intercepts natural-language inputs ──────
  // Ensures "Start My Day" or "investigate the first ticket" typed into the chat
  // input field triggers the exact same intelligence logic from any conversation state.
  const wrappedChat = useMemo<CsaChat>(() => {
    return {
      ...chat,
      handleSubmit: (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const text = chat.input.trim();
        if (!text || chat.isLoading) return;

        if (isStartMyDayIntent(text)) {
          chat.setInput("");
          void handleExecuteStartMyDay(text);
          return;
        }

        const target = resolveFollowUpReference(text, briefingTasks.length > 0 ? briefingTasks : allTasks);
        if (target) {
          onSelectTask(target);
          if (target.type === "ticket") {
            useConversationStore.getState().setActiveTicketId(target.id);
          }
        }

        chat.handleSubmit(e);
      },
      sendSuggestion: (prompt: string) => {
        handleSuggestionClick(prompt);
      },
    };
  }, [allTasks, briefingTasks, chat, handleExecuteStartMyDay, handleSuggestionClick, onSelectTask]);

  // ── 4. Elegant, Restrained CSA Welcome State ─────────────────────────────
  const emptyState = (
    <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-4 py-12 text-center space-y-6">
      {/* Clean Greeting */}
      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-m-text">
          {greeting}, {agentDisplayName}
        </h2>
        <p className="text-xs sm:text-sm text-m-text-muted max-w-md mx-auto leading-relaxed">
          Ready to assist with customer tickets, order tracking, and account management.
        </p>
      </div>

      {/* Subtle Start My Day Action */}
      <div className="pt-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleExecuteStartMyDay("Start My Day")}
          disabled={briefingLoading || chat.isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-m-text border border-m-border rounded-full hover:bg-m-surface-2 transition cursor-pointer shadow-2xs"
        >
          <Icon
            name={briefingLoading ? "loader" : "sun"}
            size="xs"
            className={briefingLoading ? "animate-spin text-m-primary" : "text-amber-500"}
          />
          <span>{briefingLoading ? "Gathering briefing…" : "Start My Day"}</span>
        </Button>
      </div>

      {/* Unobtrusive Suggestion Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg">
        {[
          { label: "Review urgent tickets", prompt: "Please look into our highest priority open tickets." },
          { label: "Track delayed shipments", prompt: "Check for any active orders with delivery delays or transit risks." },
          { label: "Update customer details", prompt: "Help me update a customer's contact information." },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleSuggestionClick(item.prompt)}
            className="text-xs text-m-text-muted hover:text-m-text bg-m-surface-2 hover:bg-m-border/40 border border-transparent hover:border-m-border px-3 py-1.5 rounded-full transition cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-m-surface overflow-hidden select-none">
      {/* ── Conversational Context Strip (Subtle Top Bar) ── */}
      <div className="flex items-center justify-between border-b border-m-border px-4 py-2 bg-m-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-m-surface-2 text-m-primary">
            <Icon name="bot" size="xs" />
          </div>
          <span className="font-semibold text-xs text-m-text">Conversational Workspace</span>
          {selectedTask && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-m-surface-2 border border-m-border px-2 py-0.5 text-[11px] text-m-text font-medium">
              <span>Task: {selectedTask.referenceNumber}</span>
              <button
                type="button"
                onClick={() => onSelectTask(null)}
                title="Deselect task"
                className="hover:text-m-error transition cursor-pointer"
              >
                <Icon name="x" size="xs" />
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Subtle Start My Day shortcut during active chat */}
          {chat.messages.length > 0 && (
            <button
              type="button"
              onClick={() => handleExecuteStartMyDay("Start My Day")}
              disabled={briefingLoading || chat.isLoading}
              title="Get a fresh Start My Day briefing"
              className="flex items-center gap-1 text-[11px] text-m-text-muted hover:text-m-text px-2 py-1 rounded hover:bg-m-surface-2 transition cursor-pointer font-medium"
            >
              <Icon
                name={briefingLoading ? "loader" : "sun"}
                size="xs"
                className={briefingLoading ? "animate-spin text-m-primary" : "text-amber-500"}
              />
              <span>Briefing</span>
            </button>
          )}

          {onOpenWorkspace && (
            <button
              type="button"
              onClick={onOpenWorkspace}
              title="Open Priority Queue"
              className="flex items-center gap-1 text-[11px] text-m-text-muted hover:text-m-text px-2 py-1 rounded hover:bg-m-surface-2 transition cursor-pointer"
            >
              <Icon name="list" size="xs" />
              <span>Queue</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearSession}
            title="Reset Chat Session"
            className="flex items-center gap-1 text-[11px] text-m-text-muted hover:text-m-text px-2 py-1 rounded hover:bg-m-surface-2 transition cursor-pointer"
          >
            <Icon name="refresh-cw" size="xs" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* ── Main Chat Stream Area ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ChatStream
          chat={wrappedChat}
          sessionCustomerName={selectedTask?.customerName}
          hideHeader={true}
          emptyState={emptyState}
        />
      </div>
    </div>
  );
}
