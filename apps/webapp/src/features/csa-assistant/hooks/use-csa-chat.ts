"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo, useState } from "react";
import type { UIMessage } from "ai";
import type { SessionContext } from "../types";

const AI_ASSIST_URL =
  process.env.NEXT_PUBLIC_AI_ASSIST_URL ?? "http://localhost:8080";

/**
 * CSA chat hook — wraps @ai-sdk/react's useChat (v6+ API) and exposes a
 * stable interface that the ChatStream component can destructure.
 */
export function useCsaChat(sessionContext: SessionContext) {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${AI_ASSIST_URL}/chat`,
        body: { context: sessionContext }
      }),
    // Re-create transport only when sessionContext identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(sessionContext)]
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

  // Send an approval command back to the AI
  const approveAction = useCallback(
    (executeCommand: string) => {
      chat.sendMessage({ text: executeCommand });
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
    sendSuggestion
  };
}

export type CsaChat = ReturnType<typeof useCsaChat>;
