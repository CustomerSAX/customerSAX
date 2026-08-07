"use client";

import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";
import type { ConversationSession } from "../types.js";

interface ConversationListProps {
  sessions: ConversationSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ConversationList({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession
}: ConversationListProps) {
  return (
    <Card variant="default" className="flex flex-col h-full">
      <CardHeader className="px-4 py-3 border-b border-m-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-m-text-muted uppercase tracking-wide">
            Conversations
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon={<Icon name="plus" size="xs" />}
            aria-label="New conversation"
            onClick={onNewSession}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon name="message-square" size="lg" className="text-m-text-muted mb-2" />
            <p className="text-xs text-m-text-muted">No conversations yet</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs"
              onClick={onNewSession}
            >
              Start a session
            </Button>
          </div>
        )}

        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-m-md text-left transition-colors cursor-pointer ${
                isActive
                  ? "bg-m-primary-50 text-m-primary"
                  : "hover:bg-m-surface-2 text-m-text"
              }`}
            >
              <Avatar
                name={initials(session.customerName)}
                size="sm"
                className={isActive ? "ring-1 ring-m-primary" : ""}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold truncate ${isActive ? "text-m-primary" : "text-m-text"}`}>
                    {session.customerName}
                  </span>
                  <span className="text-[10px] text-m-text-muted ml-1 flex-shrink-0">
                    {formatRelativeTime(session.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[11px] truncate ${isActive ? "text-m-primary/70" : "text-m-text-muted"}`}>
                    {session.topic}
                  </span>
                  {session.isActive && (
                    <Badge variant="info" size="sm" className="flex-shrink-0 text-[9px]">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
