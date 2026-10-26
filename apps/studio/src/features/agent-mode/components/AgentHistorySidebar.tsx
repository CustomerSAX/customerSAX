"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Icon, Button } from "@csa/ui";
import { formatTime as formatSharedTime } from "@/lib/format-date";

export interface SessionItem {
  sessionId: string;
  title?: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  pageContext?: { type: string; id: string } | null;
}

interface AgentHistorySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  activeSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  refreshTrigger?: number;
}

function dateGroup(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return "Previous 7 days";
    return "Older";
  } catch {
    return "Older";
  }
}

function cleanPreview(preview: string): string {
  return preview
    .replace(/\[Conversation summary[^\]]*\]\n?/g, "")
    .replace(/\[(?:hidden|approved)-action\]\s*\{.*?\}/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n+/g, " ")
    .trim() || "New conversation";
}

export function AgentHistorySidebar({
  isOpen,
  onToggle,
  onNewChat,
  activeSessionId,
  onSelectSession,
  refreshTrigger,
}: AgentHistorySidebarProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline rename state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/sessions?limit=30");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sessions?: SessionItem[] };
      setSessions(data.sessions ?? []);
    } catch {
      // If backend sessions endpoint fails or in offline dev, fall back gracefully
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      // Optimistic delete
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      if (activeSessionId === sessionId) {
        onNewChat();
      }
      try {
        await fetch(`/api/chat/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
        });
      } catch {
        // Re-fetch on failure
        fetchSessions();
      }
    },
    [activeSessionId, onNewChat, fetchSessions]
  );

  const handleStartRename = useCallback((e: React.MouseEvent, session: SessionItem) => {
    e.stopPropagation();
    setEditingSessionId(session.sessionId);
    setEditTitle(session.title || cleanPreview(session.preview));
  }, []);

  const handleSaveRename = useCallback(
    async (e: React.FormEvent | React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const trimmed = editTitle.trim();
      if (!trimmed || isSavingEdit) return;

      setIsSavingEdit(true);
      // Optimistic update
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, title: trimmed } : s))
      );
      setEditingSessionId(null);

      try {
        await fetch("/api/chat/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, title: trimmed }),
        });
      } catch {
        fetchSessions();
      } finally {
        setIsSavingEdit(false);
      }
    },
    [editTitle, isSavingEdit, fetchSessions]
  );

  const handleCancelRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
    setEditTitle("");
  }, []);

  const grouped = useMemo(() => {
    const ORDER = ["Today", "Yesterday", "Previous 7 days", "Older"];
    const map = new Map<string, SessionItem[]>();

    for (const s of sessions) {
      const group = dateGroup(s.updatedAt || s.createdAt || new Date().toISOString());
      const bucket = map.get(group) ?? [];
      bucket.push(s);
      map.set(group, bucket);
    }

    return ORDER.filter((l) => map.has(l)).map((label) => ({
      label,
      items: map.get(label)!,
    }));
  }, [sessions]);

  if (!isOpen) {
    return (
      <aside
        aria-label="Conversation history"
        className="w-0 overflow-hidden transition-all duration-200 border-r-0 border-transparent select-none shrink-0"
      />
    );
  }

  return (
    <aside
      aria-label="Conversation history"
      className="w-64 sm:w-72 h-full flex flex-col bg-m-surface-1 border-r border-m-border transition-all duration-200 select-none shrink-0 overflow-hidden"
    >
      {/* ── Top Header & New Chat Button ── */}
      <div className="p-3 border-b border-m-border space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-m-text">
            <Icon name="message-square" size="xs" className="text-m-primary" />
            <span>Conversations</span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            title="Collapse sidebar"
            className="p-1 rounded-md text-m-text-muted hover:text-m-text hover:bg-m-surface-2 transition cursor-pointer"
          >
            <Icon name="panel-left-close" size="xs" />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium bg-m-surface text-m-text hover:bg-m-surface-2 shadow-2xs border-m-border"
        >
          <Icon name="plus" size="xs" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* ── Scrollable History List ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {loading && sessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-m-text-muted flex items-center justify-center gap-2">
            <Icon name="loader" size="xs" className="animate-spin text-m-primary" />
            <span>Loading history...</span>
          </div>
        ) : error ? (
          <div className="p-3 text-center text-xs text-m-error space-y-1">
            <p>Could not load sessions</p>
            <button
              type="button"
              onClick={fetchSessions}
              className="text-[11px] underline text-m-primary cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-m-text-muted space-y-1">
            <Icon name="message-circle" size="md" className="mx-auto text-m-text-subtle mb-1 opacity-60" />
            <p className="font-medium text-m-text">No previous chats</p>
            <p className="text-[11px]">Your conversations will be saved and listed here.</p>
          </div>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label} className="space-y-1">
              <span className="text-[10px] font-semibold text-m-text-muted uppercase tracking-wider px-2 block">
                {label}
              </span>
              <div className="space-y-0.5">
                {items.map((session) => {
                  const isActive = activeSessionId === session.sessionId;
                  const isEditing = editingSessionId === session.sessionId;
                  const displayTitle = session.title ? session.title : cleanPreview(session.preview);

                  if (isEditing) {
                    return (
                      <form
                        key={session.sessionId}
                        onSubmit={(e) => handleSaveRename(e, session.sessionId)}
                        className="p-1.5 rounded-lg bg-m-surface-2 border border-m-primary/40 space-y-1.5"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded bg-m-surface border border-m-border text-m-text focus:outline-none focus:border-m-primary"
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 rounded text-m-text-muted hover:text-m-text hover:bg-m-surface"
                            title="Cancel"
                          >
                            <Icon name="x" size="xs" />
                          </button>
                          <button
                            type="submit"
                            disabled={!editTitle.trim() || isSavingEdit}
                            className="p-1 rounded text-m-primary hover:bg-m-surface font-medium"
                            title="Save"
                          >
                            <Icon name="check" size="xs" />
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={session.sessionId}
                      onClick={() => onSelectSession(session.sessionId)}
                      className={`group relative w-full text-left px-2.5 py-2 rounded-lg text-xs transition cursor-pointer flex flex-col gap-0.5 ${
                        isActive
                          ? "bg-m-primary/10 text-m-primary font-medium border border-m-primary/20"
                          : "text-m-text hover:bg-m-surface-2 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate block font-medium leading-tight flex-1">
                          {displayTitle}
                        </span>

                        {/* Hover Actions: Rename & Delete */}
                        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 transition shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(e, session)}
                            title="Rename chat"
                            className="p-0.5 rounded text-m-text-muted hover:text-m-text hover:bg-m-surface-3 transition"
                          >
                            <Icon name="pencil" size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, session.sessionId)}
                            title="Delete chat"
                            className="p-0.5 rounded text-m-text-muted hover:text-m-error hover:bg-m-surface-3 transition"
                          >
                            <Icon name="trash-2" size="xs" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-m-text-muted pt-0.5">
                        <span>{session.messageCount} msgs</span>
                        <span>{formatSharedTime(session.updatedAt || session.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-2.5 border-t border-m-border text-[11px] text-m-text-muted flex items-center justify-between shrink-0">
        <span className="truncate">CustomerX AI</span>
        <button
          type="button"
          onClick={fetchSessions}
          title="Refresh conversations"
          className="p-1 rounded text-m-text-muted hover:text-m-text hover:bg-m-surface-2 cursor-pointer"
        >
          <Icon name="refresh-cw" size="xs" />
        </button>
      </div>
    </aside>
  );
}

