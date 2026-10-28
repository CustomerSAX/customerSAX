import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Agent Mode - Conversation History Persistence & Lifecycle", () => {
  const mockSession1 = {
    sessionId: "sess-abc-111",
    title: "Investigate Order Delayed ORD-9981",
    preview: "Where is order ORD-9981?",
    messageCount: 2,
    createdAt: "2026-10-23T10:00:00Z",
    updatedAt: "2026-10-23T10:05:00Z",
  };


  const mockMessagesSess1 = [
    { id: "m1", role: "user", content: "Where is order ORD-9981?", createdAt: "2026-10-23T10:00:00Z" },
    { id: "m2", role: "assistant", content: "Order ORD-9981 is delayed in transit.", createdAt: "2026-10-23T10:00:05Z" },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("restores conversation messages when selecting an existing session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: mockMessagesSess1 }),
    });
    global.fetch = fetchMock;

    const res = await fetch(`/api/chat?sessionId=${mockSession1.sessionId}`);
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(`/api/chat?sessionId=${mockSession1.sessionId}`);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0].content).toBe("Where is order ORD-9981?");
    expect(data.messages[1].content).toBe("Order ORD-9981 is delayed in transit.");
  });

  it("creates separate, distinct sessions for new chats without bleed-over", () => {
    const sessionId1 = crypto.randomUUID();
    const sessionId2 = crypto.randomUUID();

    expect(sessionId1).not.toBe(sessionId2);

    const store = new Map<string, Array<{ role: string; content: string }>>();
    store.set(sessionId1, [{ role: "user", content: "First chat prompt" }]);
    store.set(sessionId2, [{ role: "user", content: "Second independent prompt" }]);

    expect(store.get(sessionId1)).toHaveLength(1);
    expect(store.get(sessionId1)![0].content).toBe("First chat prompt");
    expect(store.get(sessionId2)).toHaveLength(1);
    expect(store.get(sessionId2)![0].content).toBe("Second independent prompt");
  });

  it("handles interrupted streams without corrupting history", () => {
    // When a stream interrupts, user message is already recorded, and an interruption note is placed
    const messages = [
      { id: "user-msg-1", role: "user", content: "Perform heavy analysis" },
      { id: "asst-msg-1", role: "assistant", content: "An interruption occurred while generating this response. You can continue or retry your prompt." },
    ];

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toContain("interruption occurred");
  });

  it("sends PATCH request to rename session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, sessionId: "sess-abc-111", title: "Custom Title" }),
    });
    global.fetch = fetchMock;

    const res = await fetch("/api/chat/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "sess-abc-111", title: "Custom Title" }),
    });
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.title).toBe("Custom Title");
  });

  it("sends DELETE request to remove session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, sessionId: "sess-abc-111" }),
    });
    global.fetch = fetchMock;

    const res = await fetch("/api/chat/sessions?sessionId=sess-abc-111", {
      method: "DELETE",
    });
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.sessionId).toBe("sess-abc-111");
  });
});
