/**
 * MongoDB chat session store for the CSA AI Assist service.
 *
 * Stores conversation history in the `csa_chat_sessions` collection inside
 * the same MongoDB database used by the ticketing service.
 *
 * Sessions are strictly scoped per (userEmail × clientId × projectKey) to guarantee
 * tenant isolation and prevent cross-tenant IDOR access.
 *
 * Messages are stored as records { id, role, content, createdAt } for the History panel.
 *
 * If MONGO_URI is not configured the service degrades gracefully to in-memory
 * storage (dev environments without MongoDB still work).
 */

import { MongoClient, ObjectId, type Collection, type Document } from "mongodb";
import { setupDnsFallback } from "@csa/mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("ai-assist").child({ module: "mongo-chat" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string; // plain text — extracted from UIMessage parts for history display
  createdAt: string;
}

export interface ChatSession {
  _id?: ObjectId;
  sessionId: string;
  userEmail: string;
  projectKey: string;
  clientId?: string;
  title?: string;
  pageContext?: Record<string, unknown> | { type: string; id: string } | null;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionSummary {
  sessionId: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  pageContext: Record<string, unknown> | { type: string; id: string } | null;
}

// ---------------------------------------------------------------------------
// Title Generation Helper
// ---------------------------------------------------------------------------

export function generateSessionTitle(firstUserText: string): string {
  const cleaned = firstUserText
    .replace(/^\[(?:approved|hidden)-action\]\s*\{.*?\}\s*/gi, "")
    .replace(/^\[(?:approved|hidden)-action\]\s*/gi, "")
    .replace(/^Start My Day/i, "Daily Briefing")
    .replace(/[*#`_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "New Conversation";
  if (cleaned.length <= 45) return cleaned;
  const truncated = cleaned.slice(0, 42);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 18 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let _clientPromise: Promise<MongoClient> | null = null;

function getClient(): Promise<MongoClient> | null {
  const uri = process.env.MONGO_URI?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) return null; // graceful degradation — no MongoDB configured

  if (!_clientPromise) {
    setupDnsFallback();
    const client = new MongoClient(uri);
    _clientPromise = client.connect();
  }
  return _clientPromise;
}

const COLLECTION = process.env.MONGO_CHAT_COLLECTION ?? "csa_chat_sessions";
const DB_NAME = () => process.env.MONGO_DB_NAME?.trim() || process.env.MONGO_TICKETS_DB?.trim() || "csa";

async function getCollection(): Promise<Collection<Document> | null> {
  const clientPromise = getClient();
  if (!clientPromise) return null;

  const client = await clientPromise;
  const col = client.db(DB_NAME()).collection(COLLECTION);

  // Idempotent index setup — safe to run on every cold start
  await col.createIndex({ sessionId: 1 }, { unique: true, background: true }).catch(() => {});
  await col.createIndex({ userEmail: 1, clientId: 1, updatedAt: -1 }, { background: true }).catch(() => {});
  await col.createIndex({ userEmail: 1, updatedAt: -1 }, { background: true }).catch(() => {});

  return col;
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev without MongoDB)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, ChatSession>();

export function clearMemoryStore(): void {
  memoryStore.clear();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads an existing session by sessionId (ownership-scoped to userEmail and optional clientId) or
 * creates a new one. The sessionId is always provided by the client (a UUID
 * generated on first conversation start) so no header round-trip is needed.
 */
export async function loadOrCreateSession(
  sessionId: string,
  userEmail: string,
  projectKey: string,
  clientId?: string,
  pageContext?: Record<string, unknown> | { type: string; id: string } | null
): Promise<ChatSession> {
  const col = await getCollection();
  const now = new Date();

  if (col) {
    const query: Record<string, unknown> = { sessionId, userEmail };
    if (clientId) query.clientId = clientId;

    const existing = await col.findOne(query);
    if (existing) {
      if (pageContext || (clientId && !existing.clientId)) {
        const updateFields: Record<string, unknown> = { updatedAt: now };
        if (pageContext) updateFields.pageContext = pageContext;
        if (clientId && !existing.clientId) updateFields.clientId = clientId;
        await col.updateOne({ sessionId }, { $set: updateFields });
      }
      return existing as unknown as ChatSession;
    }

    const newSession: Omit<ChatSession, "_id"> = {
      sessionId,
      userEmail,
      projectKey,
      clientId,
      pageContext: pageContext ?? null,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await col.insertOne(newSession as Document);
    return newSession as ChatSession;
  }

  // In-memory fallback
  const existing = memoryStore.get(sessionId);
  if (existing && existing.userEmail === userEmail && (!clientId || !existing.clientId || existing.clientId === clientId)) {
    if (pageContext) {
      existing.pageContext = pageContext;
      existing.updatedAt = now;
    }
    if (clientId && !existing.clientId) {
      existing.clientId = clientId;
    }
    return existing;
  }

  const newSession: ChatSession = {
    sessionId,
    userEmail,
    projectKey,
    clientId,
    pageContext: pageContext ?? null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.set(sessionId, newSession);
  return newSession;
}

/**
 * Updates the active page context for an existing session.
 */
export async function updateSessionPageContext(
  sessionId: string,
  pageContext: Record<string, unknown> | { type: string; id: string } | null
): Promise<void> {
  try {
    const col = await getCollection();
    if (col) {
      await col.updateOne(
        { sessionId },
        { $set: { pageContext: pageContext ?? null, updatedAt: new Date() } }
      );
      return;
    }
    const session = memoryStore.get(sessionId);
    if (session) {
      session.pageContext = pageContext ?? null;
      session.updatedAt = new Date();
    }
  } catch (err) {
    log.error("updateSessionPageContext failed", err);
  }
}

/**
 * Appends new messages to a session with message deduplication and automatic title generation.
 * Handles early user message recording as well as post-stream assistant updates.
 */
export async function appendSessionMessages(
  sessionId: string,
  newMessages: StoredMessage[],
  clientId?: string
): Promise<void> {
  if (!newMessages.length) return;
  try {
    const col = await getCollection();
    if (col) {
      const existing = (await col.findOne({ sessionId })) as ChatSession | null;
      if (existing) {
        const existingIds = new Set((existing.messages || []).map((m) => m.id));
        const messagesToAdd = newMessages.filter((m) => !existingIds.has(m.id));

        const updateDoc: Record<string, unknown> = {
          $set: { updatedAt: new Date() },
        };

        if (!existing.title && newMessages.length > 0) {
          const userMsg = newMessages.find((m) => m.role === "user");
          if (userMsg && userMsg.content) {
            (updateDoc.$set as Record<string, unknown>).title = generateSessionTitle(userMsg.content);
          }
        }

        if (clientId && !existing.clientId) {
          (updateDoc.$set as Record<string, unknown>).clientId = clientId;
        }

        if (messagesToAdd.length > 0) {
          updateDoc.$push = { messages: { $each: messagesToAdd as unknown[] } };
        }

        await col.updateOne({ sessionId }, updateDoc);
        return;
      }
    }

    // In-memory fallback
    const session = memoryStore.get(sessionId);
    if (session) {
      const existingIds = new Set(session.messages.map((m) => m.id));
      const messagesToAdd = newMessages.filter((m) => !existingIds.has(m.id));

      if (!session.title && newMessages.length > 0) {
        const userMsg = newMessages.find((m) => m.role === "user");
        if (userMsg && userMsg.content) {
          session.title = generateSessionTitle(userMsg.content);
        }
      }
      if (clientId && !session.clientId) {
        session.clientId = clientId;
      }
      session.messages.push(...messagesToAdd);
      session.updatedAt = new Date();
    }
  } catch (err) {
    // Non-fatal: persistence failure must never break the streaming response
    log.error("appendSessionMessages failed", err);
  }
}

/**
 * Returns the stored messages for a session, strictly verifying user and tenant ownership.
 */
export async function getSessionMessages(
  sessionId: string,
  userEmail: string,
  clientId?: string
): Promise<StoredMessage[]> {
  try {
    const col = await getCollection();
    const query: Record<string, unknown> = { sessionId, userEmail };
    if (clientId) query.clientId = clientId;

    if (col) {
      const session = await col.findOne(query);
      return (session?.messages as StoredMessage[]) ?? [];
    }
    const session = memoryStore.get(sessionId);
    if (
      session &&
      session.userEmail === userEmail &&
      (!clientId || !session.clientId || session.clientId === clientId)
    ) {
      return session.messages;
    }
    return [];
  } catch (err) {
    log.error("getSessionMessages failed", err);
    return [];
  }
}

/**
 * Returns a paginated list of session summaries for the History panel,
 * strictly scoped to the authenticated user and tenant.
 * Only sessions with at least one message are included.
 */
export async function listSessions(
  userEmail: string,
  projectKey: string,
  clientId?: string,
  limit = 30,
  skip = 0
): Promise<{ sessions: SessionSummary[]; total: number }> {
  try {
    const col = await getCollection();
    if (col) {
      const match: Record<string, unknown> = {
        userEmail,
        "messages.0": { $exists: true },
      };
      if (clientId) match.clientId = clientId;
      if (projectKey) match.projectKey = projectKey;

      const [sessions, total] = await Promise.all([
        col
          .aggregate<SessionSummary>([
            { $match: match },
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                sessionId: 1,
                createdAt: 1,
                updatedAt: 1,
                pageContext: 1,
                title: { $ifNull: ["$title", { $arrayElemAt: ["$messages.content", 0] }] },
                preview: { $arrayElemAt: ["$messages.content", 0] },
                messageCount: { $size: "$messages" },
              },
            },
          ])
          .toArray(),
        col.countDocuments(match),
      ]);

      const formatted = sessions.map((s) => ({
        ...s,
        title: s.title ? generateSessionTitle(s.title) : generateSessionTitle(s.preview || ""),
      }));

      return { sessions: formatted, total };
    }

    // In-memory fallback
    const userSessions = [...memoryStore.values()]
      .filter(
        (s) =>
          s.userEmail === userEmail &&
          (!clientId || !s.clientId || s.clientId === clientId) &&
          (!projectKey || !s.projectKey || s.projectKey === projectKey) &&
          s.messages.length > 0
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const paginated = userSessions.slice(skip, skip + limit);
    const summaries: SessionSummary[] = paginated.map((s) => ({
      sessionId: s.sessionId,
      title: s.title || generateSessionTitle(s.messages[0]?.content ?? ""),
      preview: s.messages[0]?.content ?? "",
      messageCount: s.messages.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      pageContext: s.pageContext ?? null,
    }));

    return { sessions: summaries, total: userSessions.length };
  } catch (err) {
    log.error("listSessions failed", err);
    return { sessions: [], total: 0 };
  }
}

/**
 * Renames an existing chat session with user and tenant ownership check.
 */
export async function renameSession(
  sessionId: string,
  userEmail: string,
  clientId: string | undefined,
  newTitle: string
): Promise<boolean> {
  const col = await getCollection();
  const query: Record<string, unknown> = { sessionId, userEmail };
  if (clientId) query.clientId = clientId;

  const title = newTitle.trim().slice(0, 80);

  if (col) {
    const res = await col.updateOne(query, {
      $set: { title, updatedAt: new Date() },
    });
    return res.matchedCount > 0;
  }

  const session = memoryStore.get(sessionId);
  if (
    session &&
    session.userEmail === userEmail &&
    (!clientId || !session.clientId || session.clientId === clientId)
  ) {
    session.title = title;
    session.updatedAt = new Date();
    return true;
  }
  return false;
}

/**
 * Deletes an existing chat session with user and tenant ownership check.
 */
export async function deleteSession(
  sessionId: string,
  userEmail: string,
  clientId?: string
): Promise<boolean> {
  const col = await getCollection();
  const query: Record<string, unknown> = { sessionId, userEmail };
  if (clientId) query.clientId = clientId;

  if (col) {
    const res = await col.deleteOne(query);
    return res.deletedCount > 0;
  }

  const session = memoryStore.get(sessionId);
  if (
    session &&
    session.userEmail === userEmail &&
    (!clientId || !session.clientId || session.clientId === clientId)
  ) {
    memoryStore.delete(sessionId);
    return true;
  }
  return false;
}
