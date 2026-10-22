"use client";

import { Icon } from "@csa/ui";
import { ChatStream } from "@/features/csa-assistant/components/ChatStream";
import type { CsaChat } from "@/features/csa-assistant/hooks/use-csa-chat";
import type { AgentTask } from "../types";

interface AgentChatPanelProps {
  chat: CsaChat;
  selectedTask: AgentTask | null;
  onClearSession: () => void;
}

export function AgentChatPanel({ chat, selectedTask, onClearSession }: AgentChatPanelProps) {
  return (
    <div className="flex flex-col h-full bg-m-surface overflow-hidden select-none">
      {/* ── Chat Header ── */}
      <div className="flex items-center justify-between border-b border-m-border px-4 py-2.5 bg-m-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Icon name="bot" size="xs" />
          </div>
          <span className="font-semibold text-xs text-m-text">AI Assistant</span>
          {selectedTask && (
            <span className="rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700 font-medium">
              Task: {selectedTask.referenceNumber}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
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
          chat={chat}
          sessionCustomerName={selectedTask?.customerName}
        />
      </div>
    </div>
  );
}
