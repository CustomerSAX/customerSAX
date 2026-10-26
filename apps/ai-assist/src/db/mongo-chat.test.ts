import { describe, it, expect, beforeEach } from "vitest";
import {
  loadOrCreateSession,
  appendSessionMessages,
  getSessionMessages,
  listSessions,
  renameSession,
  deleteSession,
  generateSessionTitle,
  clearMemoryStore,
  type StoredMessage,
} from "./mongo-chat.js";

describe("CustomerX Chat Persistence & Multi-Tenant Isolation (mongo-chat)", () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  describe("Title Generation", () => {
    it("generates a clean title from standard user text", () => {
      const title = generateSessionTitle("Where is customer order ORD-12345?");
      expect(title).toBe("Where is customer order ORD-12345?");
    });

    it("translates 'Start My Day' prompt to 'Daily Briefing'", () => {
      const title = generateSessionTitle("Start My Day — give me an overview of urgent items");
      expect(title).toContain("Daily Briefing");
    });

    it("strips internal action wrappers from user messages", () => {
      const text = "[approved-action] { \"type\": \"customer.update\" } Please change phone number to +123456789";
      const title = generateSessionTitle(text);
      expect(title).not.toContain("[approved-action]");
      expect(title).toBe("Please change phone number to +123456789");
    });

    it("truncates very long user messages cleanly with ellipsis", () => {
      const longText = "This is an extremely long user query that goes on and on and on and explains several different issues with orders and shipments";
      const title = generateSessionTitle(longText);
      expect(title.length).toBeLessThanOrEqual(45);
      expect(title.endsWith("…")).toBe(true);
    });
  });

  describe("Session Lifecycle & Restart Recovery", () => {
    const sessionId = "session-test-uuid-1";
    const userEmail = "rep@brand.com";
    const projectKey = "project-alpha";
    const clientId = "client-tenant-01";

    it("creates a new session with authenticated tenant metadata", async () => {
      const session = await loadOrCreateSession(sessionId, userEmail, projectKey, clientId);
      expect(session.sessionId).toBe(sessionId);
      expect(session.userEmail).toBe(userEmail);
      expect(session.projectKey).toBe(projectKey);
      expect(session.clientId).toBe(clientId);
      expect(session.messages).toEqual([]);
    });

    it("persists user message immediately on receipt", async () => {
      await loadOrCreateSession(sessionId, userEmail, projectKey, clientId);

      const userMsg: StoredMessage = {
        id: "msg-user-1",
        role: "user",
        content: "Investigate ticket T-100",
        createdAt: new Date().toISOString(),
      };

      await appendSessionMessages(sessionId, [userMsg], clientId);

      const messages = await getSessionMessages(sessionId, userEmail, clientId);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("msg-user-1");
      expect(messages[0].content).toBe("Investigate ticket T-100");
    });

    it("restores conversation history after simulated server restart", async () => {
      // Turn 1: user sends message, assistant responds
      await loadOrCreateSession(sessionId, userEmail, projectKey, clientId);
      await appendSessionMessages(
        sessionId,
        [
          {
            id: "msg-user-1",
            role: "user",
            content: "Check shipping delay for ORD-9981",
            createdAt: new Date().toISOString(),
          },
        ],
        clientId
      );
      await appendSessionMessages(
        sessionId,
        [
          {
            id: "msg-assistant-1",
            role: "assistant",
            content: "Order ORD-9981 is delayed in transit. Carrier reported a weather delay.",
            createdAt: new Date().toISOString(),
          },
        ],
        clientId
      );

      // Verify conversation has 2 messages
      const beforeRestart = await getSessionMessages(sessionId, userEmail, clientId);
      expect(beforeRestart).toHaveLength(2);

      // Simulate client re-opening / reconnecting after restart:
      // loadOrCreateSession returns the existing session
      const restoredSession = await loadOrCreateSession(sessionId, userEmail, projectKey, clientId);
      expect(restoredSession.sessionId).toBe(sessionId);

      const afterRestart = await getSessionMessages(sessionId, userEmail, clientId);
      expect(afterRestart).toHaveLength(2);
      expect(afterRestart[0].role).toBe("user");
      expect(afterRestart[1].role).toBe("assistant");
    });

    it("deduplicates messages by ID when appended multiple times", async () => {
      await loadOrCreateSession(sessionId, userEmail, projectKey, clientId);
      const msg: StoredMessage = {
        id: "msg-fixed-id",
        role: "user",
        content: "Test query",
        createdAt: new Date().toISOString(),
      };

      await appendSessionMessages(sessionId, [msg], clientId);
      await appendSessionMessages(sessionId, [msg], clientId);

      const messages = await getSessionMessages(sessionId, userEmail, clientId);
      expect(messages).toHaveLength(1);
    });

    it("captures tool action summaries in assistant history", async () => {
      await loadOrCreateSession(sessionId, userEmail, projectKey, clientId);
      const toolActionMsg: StoredMessage = {
        id: "msg-asst-action",
        role: "assistant",
        content: "[Proposed Action: Update Phone Number] Update customer contact number to +1-555-0199",
        createdAt: new Date().toISOString(),
      };

      await appendSessionMessages(sessionId, [toolActionMsg], clientId);
      const messages = await getSessionMessages(sessionId, userEmail, clientId);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain("[Proposed Action: Update Phone Number]");
    });
  });

  describe("Multi-Tenant & User Access Control (IDOR Prevention)", () => {
    const session1 = "tenant1-session-1";
    const user1 = "agent@tenant1.com";
    const client1 = "tenant-1";

    const user2 = "agent@tenant2.com";
    const client2 = "tenant-2";

    beforeEach(async () => {
      await loadOrCreateSession(session1, user1, "project-1", client1);
      await appendSessionMessages(
        session1,
        [
          {
            id: "msg-secret",
            role: "user",
            content: "Confidential ticket notes for tenant 1",
            createdAt: new Date().toISOString(),
          },
        ],
        client1
      );
    });

    it("allows the owner to read the session transcript", async () => {
      const messages = await getSessionMessages(session1, user1, client1);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Confidential ticket notes for tenant 1");
    });

    it("blocks a different user from reading the session (cross-user IDOR)", async () => {
      const messages = await getSessionMessages(session1, user2, client1);
      expect(messages).toEqual([]);
    });

    it("blocks a different tenant from reading the session (cross-tenant IDOR)", async () => {
      const messages = await getSessionMessages(session1, user1, client2);
      expect(messages).toEqual([]);
    });

    it("does not leak another tenant's sessions in listSessions", async () => {
      // User 2 in Tenant 2 lists sessions
      const listForTenant2 = await listSessions(user2, "project-2", client2);
      expect(listForTenant2.sessions).toHaveLength(0);

      // User 1 in Tenant 1 lists sessions
      const listForTenant1 = await listSessions(user1, "project-1", client1);
      expect(listForTenant1.sessions).toHaveLength(1);
      expect(listForTenant1.sessions[0].sessionId).toBe(session1);
    });

    it("enforces tenant ownership on renameSession", async () => {
      // Attacker in tenant 2 attempts to rename tenant 1's session
      const attackRename = await renameSession(session1, user2, client2, "Hacked Session");
      expect(attackRename).toBe(false);

      // Legitimate owner renames session
      const legitRename = await renameSession(session1, user1, client1, "Verified Session Title");
      expect(legitRename).toBe(true);

      const list = await listSessions(user1, "project-1", client1);
      expect(list.sessions[0].title).toBe("Verified Session Title");
    });

    it("enforces tenant ownership on deleteSession", async () => {
      // Attacker attempts to delete tenant 1's session
      const attackDelete = await deleteSession(session1, user2, client2);
      expect(attackDelete).toBe(false);

      // Verify session is still intact
      const intactMessages = await getSessionMessages(session1, user1, client1);
      expect(intactMessages).toHaveLength(1);

      // Legitimate owner deletes session
      const legitDelete = await deleteSession(session1, user1, client1);
      expect(legitDelete).toBe(true);

      // Verify session is gone
      const deletedMessages = await getSessionMessages(session1, user1, client1);
      expect(deletedMessages).toHaveLength(0);
    });
  });
});
