"use client";

import { useCallback, useState } from "react";
import type { ConversationSession, SessionContext } from "./types";
import { useCsaChat } from "./hooks/use-csa-chat";
import { ConversationList } from "./components/ConversationList";
import { ChatStream } from "./components/ChatStream";
import { ContextPanel } from "./components/ContextPanel";

// Default session context — in production this comes from auth + routing
const DEFAULT_CONTEXT: SessionContext = {
  userEmail: "agent@csa.local",
  userRole: "Support Agent",
  projectKey: process.env.NEXT_PUBLIC_CT_PROJECT_KEY ?? "rc_b2b_shop_july_2023",
  businessType: "b2c",
  pageContext: null
};

// Seed sessions for the left pane (real sessions come from a backend store)
const SEED_SESSIONS: ConversationSession[] = [
  {
    id: "session-1",
    customerName: "Mia Johnson",
    customerEmail: "mia@example.com",
    topic: "Delayed order inquiry",
    startedAt: new Date(Date.now() - 8 * 60 * 1000),
    isActive: true,
    messageCount: 4
  },
  {
    id: "session-2",
    customerName: "Rahul Mehta",
    customerEmail: "rahul@example.com",
    topic: "Discount code not applied",
    startedAt: new Date(Date.now() - 25 * 60 * 1000),
    isActive: false,
    messageCount: 2
  },
  {
    id: "session-3",
    customerName: "Sofia Garcia",
    customerEmail: "sofia@example.com",
    topic: "Product availability",
    startedAt: new Date(Date.now() - 60 * 60 * 1000),
    isActive: false,
    messageCount: 1
  }
];

let sessionCounter = SEED_SESSIONS.length + 1;

export function CsaAssistant() {
  const [sessions, setSessions] = useState<ConversationSession[]>(SEED_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>("session-1");
  const [sessionContext] = useState<SessionContext>(DEFAULT_CONTEXT);

  const chat = useCsaChat(sessionContext);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const handleNewSession = useCallback(() => {
    const id = `session-${sessionCounter++}`;
    const newSession: ConversationSession = {
      id,
      customerName: "New Session",
      customerEmail: undefined,
      topic: "Starting…",
      startedAt: new Date(),
      isActive: true,
      messageCount: 0
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    // Clear the chat
    chat.setMessages([]);
  }, [chat]);

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      // In production, load the session's messages from the backend here
      chat.setMessages([]);
    },
    [chat]
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px] h-[calc(100vh-10rem)] min-h-[540px]">
      {/* Left pane — conversation list */}
      <ConversationList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      {/* Center pane — streaming chat */}
      <ChatStream
        chat={chat}
        sessionCustomerName={activeSession?.customerName}
      />

      {/* Right pane — intelligence / context */}
      <ContextPanel messages={chat.messages} />
    </div>
  );
}
