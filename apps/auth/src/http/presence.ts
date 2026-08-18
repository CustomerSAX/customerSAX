import type { IncomingMessage, ServerResponse } from "node:http";
import { getCurrentSession } from "./auth.js";
import { readJsonBody, sendJson, sendNoContent } from "./json.js";
import { listProjectPresence, recordPresenceHeartbeat, type PresenceStatus } from "../presence/store.js";
import { latestSessionCreatedAtByUserIds, listActiveUsersByProject } from "../users/repository.js";

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function presenceStatus(value: unknown): PresenceStatus {
  return value === "away" ? "away" : "online";
}

function canAccessProject(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>["user"],
  projectKey: string
) {
  if (user.role === "superadmin") return true;
  return (user.projects ?? []).some((project) => project.projectKey === projectKey);
}

export async function heartbeatPresence(request: IncomingMessage, response: ServerResponse) {
  const session = await getCurrentSession(request);
  const user = session?.user;
  const projectKey = user?.activeProjectKey ?? user?.projectKey;

  if (!user?.email || !user.id || !projectKey) {
    sendJson(response, 401, { error: "unauthenticated" });
    return;
  }

  const body = await readJsonBody<Record<string, unknown>>(request);
  const tabId = stringField(body.tabId);

  if (!tabId) {
    sendJson(response, 400, { error: "tabId is required" });
    return;
  }

  await recordPresenceHeartbeat({
    userId: user.id,
    email: user.email,
    name: user.name || user.email,
    role: user.role,
    projectKey,
    clientId: user.activeClientId,
    tabId,
    status: presenceStatus(body.status),
    activeRoute: stringField(body.activeRoute) || undefined,
    activeTicketId: stringField(body.activeTicketId) || undefined
  });

  sendNoContent(response);
}

export async function listPresenceAgents(
  request: IncomingMessage,
  response: ServerResponse,
  projectKey: string
) {
  const session = await getCurrentSession(request);
  const user = session?.user;

  if (!user?.email) {
    sendJson(response, 401, { agents: [], error: "unauthenticated" });
    return;
  }

  if (!projectKey || !canAccessProject(user, projectKey)) {
    sendJson(response, 403, { agents: [], error: "project access denied" });
    return;
  }

  const [users, livePresence] = await Promise.all([
    listActiveUsersByProject(projectKey, user.activeClientId),
    listProjectPresence(projectKey)
  ]);
  const userIds = users.map((agent) => agent.id || String(agent._id ?? agent.email));
  const lastLoginByUserId = await latestSessionCreatedAtByUserIds(userIds);
  const liveByEmail = new Map(livePresence.map((agent) => [agent.email.toLowerCase(), agent]));

  const agents = users.map((agent) => {
    const id = agent.id || String(agent._id ?? agent.email);
    const email = agent.email.toLowerCase();
    const live = liveByEmail.get(email);
    const projectMembership = (agent.projects ?? []).find(
      (project) =>
        project.projectKey === projectKey &&
        (!user.activeClientId || project.clientId === user.activeClientId)
    );
    const name = agent.name || [agent.firstName, agent.lastName].filter(Boolean).join(" ") || agent.email;

    return {
      id,
      email,
      name,
      role: projectMembership?.role ?? agent.role ?? "agent",
      projectKey,
      status: live?.status ?? "offline",
      lastSeenAt: live?.lastSeenAt ?? null,
      lastLoggedInAt: lastLoginByUserId.get(id)?.toISOString() ?? null,
      activeRoute: live?.activeRoute ?? null,
      activeTicketId: live?.activeTicketId ?? null,
      tabCount: live?.tabCount ?? 0
    };
  });

  sendJson(response, 200, { agents, total: agents.length });
}
