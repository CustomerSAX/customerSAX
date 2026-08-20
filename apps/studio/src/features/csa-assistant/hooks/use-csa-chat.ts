"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UIMessage } from "ai";
import type { SessionContext } from "../types";

// Same-origin streaming proxy. The browser never talks to ai-assist directly:
// `/api/chat/stream` resolves the authenticated user server-side and forwards
// trusted identity + ACL as x-csa-* headers, so identity/permissions can no
// longer be spoofed from the client body (S1 trust-boundary fix).
const CHAT_STREAM_API = "/api/chat/stream";

// localStorage key for the current conversation's session ID.
// Each distinct conversation (new tab, "New Conversation" click) gets
// its own UUID so MongoDB stores separate session records.
const SESSION_ID_KEY = "csa-session-id";

function getOrCreateSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_ID_KEY);
    if (stored?.trim()) return stored.trim();
  } catch { /* SSR or quota — fall through */ }
  const id = crypto.randomUUID();
  try { localStorage.setItem(SESSION_ID_KEY, id); } catch { /* ignore */ }
  return id;
}

/**
 * CSA chat hook — wraps @ai-sdk/react's useChat (v6+ API) and exposes a
 * stable interface that the ChatStream component can destructure.
 *
 * Session lifecycle:
 *   - A UUID is generated on first use and persisted in localStorage.
 *   - Every POST /chat includes { sessionId } in the body alongside { context }.
 *   - The ai-assist service uses this UUID to create or load a MongoDB session.
 *   - "New Conversation" (index.tsx) calls clearSession() to mint a fresh UUID.
 */
export function useCsaChat(sessionContext: SessionContext) {
  const [input, setInput] = useState("");

  // Session ID is stable for the life of the current conversation.
  // We use a ref so the transport useMemo can reference it without re-creating.
  const sessionIdRef = useRef<string>("");

  // Initialise once on client mount (SSR-safe: localStorage isn't available during SSR)
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = getOrCreateSessionId();
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: CHAT_STREAM_API,
        body: {
          // Identity (userEmail/role/projectKey/clientId) and ACL are NEVER sent
          // from the browser — the /api/chat/stream proxy derives them from the
          // httpOnly session and forwards them as trusted x-csa-* headers. Only
          // benign, non-identity presentation context is carried in the body.
          context: {
            businessType: sessionContext.businessType,
            pageContext: sessionContext.pageContext ?? null,
            proactiveHint: sessionContext.proactiveHint ?? null,
            vipThreshold: sessionContext.vipThreshold,
          },
          // sessionId is read from the ref at call time — changes between
          // "New Conversation" clicks without recreating the transport.
          get sessionId() { return sessionIdRef.current || getOrCreateSessionId(); }
        }
      }),
    [
      sessionContext.businessType,
      sessionContext.pageContext,
      sessionContext.proactiveHint,
      sessionContext.vipThreshold,
    ]
  );

  const chat = useChat({ transport });

  const isLoading = chat.status === "submitted" || chat.status === "streaming";

  // Stable handleInputChange for <input onChange={handleInputChange}>
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value),
    []
  );

  // Stable handleSubmit for <form onSubmit={handleSubmit}>
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      chat.sendMessage({ text: input.trim() });
      setInput("");
    },
    [chat, input, isLoading]
  );

  // Send an approval command back to the AI.
  // Prefix with [approved-action] so ChatStream's isInternalMessageText filter
  // hides it from the conversation view — the approval card already communicates
  // the intent visually, so showing the raw command as a user bubble is noise.
  // The model recognises [approved-action] (per system prompt) and executes the
  // pending write in the next turn.
  const approveAction = useCallback(
    (executeCommand: string) => {
      chat.sendMessage({ text: `[approved-action] ${executeCommand}` });
    },
    [chat]
  );

  // Send a suggested-action prompt
  const sendSuggestion = useCallback(
    (prompt: string) => {
      chat.sendMessage({ text: prompt });
    },
    [chat]
  );

  /**
   * Start a fresh session — generates a new UUID, persists it, and returns it.
   * Call this from "New Conversation" click so MongoDB creates a new session record.
   */
  const clearSession = useCallback(() => {
    const newId = crypto.randomUUID();
    sessionIdRef.current = newId;
    try { localStorage.setItem(SESSION_ID_KEY, newId); } catch { /* ignore */ }
    return newId;
  }, []);

  /**
   * Restore a specific session — used by the "Continue" button in ChatHistory.
   * Sets the session ID so subsequent messages go to the same MongoDB session.
   */
  const restoreSession = useCallback((sessionId: string) => {
    sessionIdRef.current = sessionId;
    try { localStorage.setItem(SESSION_ID_KEY, sessionId); } catch { /* ignore */ }
  }, []);

  return {
    // From useChat / AbstractChat
    messages: chat.messages as UIMessage[],
    error: chat.error,
    status: chat.status,
    stop: chat.stop,
    setMessages: chat.setMessages,

    // Adapted / local state
    input,
    handleInputChange,
    handleSubmit,
    isLoading,

    // Custom helpers
    approveAction,
    sendSuggestion,
    clearSession,
    restoreSession
  };
}

export type CsaChat = ReturnType<typeof useCsaChat>;
