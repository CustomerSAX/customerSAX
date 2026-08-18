/**
 * Redis-backed agent presence.
 *
 * Presence is owned by auth because it describes authenticated human users,
 * not the AI assistant. Keys are short-lived and refreshed by browser tabs.
 */

import { createClient } from "redis";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClientAny = any;

export type PresenceStatus = "online" | "away";

export interface PresenceHeartbeat {
  userId: string;
  email: string;
  name: string;
  role: string;
  projectKey: string;
  clientId?: string;
  tabId: string;
  status: PresenceStatus;
  activeRoute?: string;
  activeTicketId?: string;
}

export interface AgentPresence {
  userId: string;
  email: string;
  name: string;
  role: string;
  projectKey: string;
  clientId?: string;
  status: PresenceStatus;
  lastSeenAt: string;
  activeRoute?: string;
  activeTicketId?: string;
  tabCount: number;
}

const DEFAULT_TTL_SECONDS = 75;
const KEY_PREFIX = "presence:agent:";

let _client: RedisClientAny = null;
let _connecting = false;

async function getClient(): Promise<RedisClientAny | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (_client?.isReady) return _client;
  if (_connecting) return null;

  try {
    _connecting = true;
    const client = createClient({ url });
    client.on("error", (err: Error) => {
      console.warn("[presence] Redis error - presence disabled:", err.message);
      _client = null;
    });
    await client.connect();
    _client = client;
    return _client;
  } catch (err) {
    console.warn("[presence] Redis connect failed (non-fatal):", (err as Error).message);
    _client = null;
    return null;
  } finally {
    _connecting = false;
  }
}

function safeSegment(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase());
}

function presenceKey(projectKey: string, userId: string, tabId: string): string {
  return `${KEY_PREFIX}${safeSegment(projectKey)}:${safeSegment(userId)}:${safeSegment(tabId)}`;
}

function projectPattern(projectKey: string): string {
  return `${KEY_PREFIX}${safeSegment(projectKey)}:*`;
}

export async function recordPresenceHeartbeat(
  heartbeat: PresenceHeartbeat,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;

    const now = new Date().toISOString();
    const key = presenceKey(heartbeat.projectKey, heartbeat.userId, heartbeat.tabId);
    const fields: Record<string, string> = {
      userId: heartbeat.userId,
      email: heartbeat.email.trim().toLowerCase(),
      name: heartbeat.name,
      role: heartbeat.role,
      projectKey: heartbeat.projectKey,
      status: heartbeat.status,
      tabId: heartbeat.tabId,
      lastSeenAt: now
    };

    if (heartbeat.clientId) fields.clientId = heartbeat.clientId;
    if (heartbeat.activeRoute) fields.activeRoute = heartbeat.activeRoute;
    if (heartbeat.activeTicketId) fields.activeTicketId = heartbeat.activeTicketId;

    await client.hSet(key, fields);
    await client.expire(key, ttlSeconds);
  } catch (err) {
    console.warn("[presence] heartbeat failed (non-fatal):", (err as Error).message);
  }
}

export async function listProjectPresence(projectKey: string): Promise<AgentPresence[]> {
  try {
    const client = await getClient();
    if (!client) return [];

    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: projectPattern(projectKey), COUNT: 100 })) {
      keys.push(String(key));
    }

    if (keys.length === 0) return [];

    const records = await Promise.all(keys.map((key) => client.hGetAll(key)));
    const byEmail = new Map<string, AgentPresence>();

    for (const record of records) {
      if (!record?.email || !record?.userId || !record?.lastSeenAt) continue;

      const email = String(record.email).toLowerCase();
      const existing = byEmail.get(email);
      const status = record.status === "away" ? "away" : "online";
      const candidate: AgentPresence = {
        userId: String(record.userId),
        email,
        name: String(record.name ?? email),
        role: String(record.role ?? "agent"),
        projectKey: String(record.projectKey ?? projectKey),
        clientId: record.clientId ? String(record.clientId) : undefined,
        status,
        lastSeenAt: String(record.lastSeenAt),
        activeRoute: record.activeRoute ? String(record.activeRoute) : undefined,
        activeTicketId: record.activeTicketId ? String(record.activeTicketId) : undefined,
        tabCount: 1
      };

      if (!existing) {
        byEmail.set(email, candidate);
        continue;
      }

      existing.tabCount += 1;
      if (new Date(candidate.lastSeenAt).getTime() > new Date(existing.lastSeenAt).getTime()) {
        existing.lastSeenAt = candidate.lastSeenAt;
        existing.activeRoute = candidate.activeRoute;
        existing.activeTicketId = candidate.activeTicketId;
      }
      if (candidate.status === "online") existing.status = "online";
    }

    return [...byEmail.values()].sort((a, b) => {
      if (a.status !== b.status) return a.status === "online" ? -1 : 1;
      return a.email.localeCompare(b.email);
    });
  } catch (err) {
    console.warn("[presence] list failed (non-fatal):", (err as Error).message);
    return [];
  }
}
