/**
 * MongoDB chat session store for the CSA AI Assist service.
 *
 * Stores conversation history in the `csa_chat_sessions` collection inside
 * the same MongoDB database used by the ticketing service.
 *
 * Sessions are scoped per (userEmail × projectKey). Messages are stored as
 * simplified records { role, content, createdAt } for the History panel.
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
  content: string;  // plain text — extracted from UIMessage parts for history display
  createdAt: string;
}

export interface ChatSession {
  _id?: ObjectId;
  sessionId: string;
  userEmail: string;
  projectKey: string;
  pageContext?: { type: string; id: string } | null;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionSummary {
  sessionId: string;
  preview: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  pageContext: { type: string; id: string } | null;
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
  await col.createIndex({ userEmail: 1, updatedAt: -1 }, { background: true }).catch(() => {});

  return col;
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev without MongoDB)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, ChatSession>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads an existing session by sessionId (ownership-scoped to userEmail) or
 * creates a new one. The sessionId is always provided by the client (a UUID
 * generated on first conversation start) so no header round-trip is needed.
 */
export async function loadOrCreateSession(
  sessionId: string,
  userEmail: string,
  projectKey: string,
  pageContext?: { type: string; id: string } | null
): Promise<ChatSession> {
  const col = await getCollection();
  const now = new Date();

  if (col) {
    const existing = await col.findOne({ sessionId, userEmail });
    if (existing) return existing as unknown as ChatSession;

    const newSession: Omit<ChatSession, "_id"> = {
      sessionId,
      userEmail,
      projectKey,
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
  if (existing && existing.userEmail === userEmail) return existing;

  const newSession: ChatSession = {
    sessionId,
    userEmail,
    projectKey,
    pageContext: pageContext ?? null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.set(sessionId, newSession);
  return newSession;
}

/**
 * Appends new messages to a session. Called in onFinish after each streaming
 * turn completes so the conversation history accumulates turn-by-turn.
 */
export async function appendSessionMessages(
  sessionId: string,
  newMessages: StoredMessage[]
): Promise<void> {
  if (!newMessages.length) return;
  try {
    const col = await getCollection();
    if (col) {
      await col.updateOne(
        { sessionId },
        {
          $push: { messages: { $each: newMessages as unknown[] } } as Document,
          $set: { updatedAt: new Date() },
        }
      );
      return;
    }
    // In-memory fallback
    const session = [...memoryStore.values()].find((s) => s.sessionId === sessionId);
    if (session) {
      session.messages.push(...newMessages);
      session.updatedAt = new Date();
    }
  } catch (err) {
    // Non-fatal: persistence failure must never break the streaming response
    log.error("appendSessionMessages failed", err);
  }
}

/**
 * Returns the stored messages for a session, verifying ownership.
 */
export async function getSessionMessages(
  sessionId: string,
  userEmail: string
): Promise<StoredMessage[]> {
  try {
    const col = await getCollection();
    if (col) {
      const session = await col.findOne({ sessionId, userEmail });
      return (session?.messages as StoredMessage[]) ?? [];
    }
    const session = memoryStore.get(sessionId);
    if (session?.userEmail === userEmail) return session.messages;
    return [];
  } catch (err) {
    log.error("getSessionMessages failed", err);
    return [];
  }
}

/**
 * Returns a paginated list of session summaries for the History panel.
 * Only sessions with at least one message are included.
 */
export async function listSessions(
  userEmail: string,
  projectKey: string,
  limit = 20,
  skip = 0
): Promise<{ sessions: SessionSummary[]; total: number }> {
  try {
    const col = await getCollection();
    if (col) {
      const match: Record<string, unknown> = {
        userEmail,
        "messages.0": { $exists: true },
      };
      if (projectKey) match.projectKey = projectKey;

      const [sessions, total] = await Promise.all([
        col.aggregate<SessionSummary>([
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
              messageCount: { $size: "$messages" },
              preview: { $arrayElemAt: ["$messages.content", 0] },
            },
          },
        ]).toArray(),
        col.countDocuments(match),
      ]);

      return { sessions, total };
    }

    // In-memory fallback
    const userSessions = [...memoryStore.values()]
      .filter((s) => s.userEmail === userEmail && s.messages.length > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const paginated = userSessions.slice(skip, skip + limit);
    const summaries: SessionSummary[] = paginated.map((s) => ({
      sessionId: s.sessionId,
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
