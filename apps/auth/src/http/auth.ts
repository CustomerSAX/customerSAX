import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { createSessionToken, hashSessionToken } from "../security/tokens.js";
import { verifyPassword } from "../security/passwords.js";
import {
  createSession,
  findActiveSessionByTokenHash,
  findUserByEmail,
  findUserById,
  revokeSessionByTokenHash
  ,setSessionProject
} from "../users/repository.js";
import { projectsForUser, toPublicUser } from "../users/types.js";

export async function loginWithPassword(email: string, password: string) {
  const user = await findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlSeconds() * 1000);

  const projects = projectsForUser(user);
  const onlyProject = projects.length === 1 ? projects[0] : undefined;
  await createSession({
    createdAt: now,
    expiresAt,
    id: randomUUID(),
    tokenHash: hashSessionToken(token),
    userId: user.id || String(user._id ?? user.email),
    activeProjectKey: onlyProject?.projectKey,
    activeClientId: onlyProject?.clientId
  });

  return {
    expiresAt: expiresAt.toISOString(),
    token,
    user: toPublicUser(user, onlyProject?.projectKey, onlyProject?.clientId)
  };
}

export async function getCurrentSession(request: IncomingMessage) {
  const token = readBearerToken(request);

  if (!token) {
    return null;
  }

  const session = await findActiveSessionByTokenHash(hashSessionToken(token));

  if (!session) {
    return null;
  }

  const user = await findUserById(session.userId);

  if (!user) {
    return null;
  }

  return {
    expiresAt: session.expiresAt.toISOString(),
    user: toPublicUser(user, session.activeProjectKey, session.activeClientId)
  };
}

export async function selectSessionProject(request: IncomingMessage, projectKey: string, clientId?: string) {
  const token = readBearerToken(request);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await findActiveSessionByTokenHash(tokenHash);
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  const matchingProjects = projectsForUser(user).filter((candidate) => candidate.projectKey === projectKey);
  const project = clientId
    ? matchingProjects.find((candidate) => candidate.clientId === clientId)
    : matchingProjects.length === 1 ? matchingProjects[0] : undefined;
  if (!project) return { forbidden: true as const };
  await setSessionProject(tokenHash, project.projectKey, project.clientId);
  console.info("[auth] active project changed", {
    userId: user.id || String(user._id ?? user.email),
    projectKey: project.projectKey,
    clientId: project.clientId
  });
  return { expiresAt: session.expiresAt.toISOString(), user: toPublicUser(user, project.projectKey, project.clientId) };
}

export async function logout(request: IncomingMessage) {
  const token = readBearerToken(request);

  if (!token) {
    return;
  }

  await revokeSessionByTokenHash(hashSessionToken(token));
}

function readBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim() || undefined;
}

function sessionTtlSeconds() {
  const value = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 28800);

  return Number.isFinite(value) && value > 0 ? value : 28800;
}
