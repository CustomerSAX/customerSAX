import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { projectsRepo } from "@csa/mongodb";
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
import type { AuthUser } from "../users/types.js";

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
    user: await toPublicUserWithShellMode(user, onlyProject?.projectKey, onlyProject?.clientId)
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
    user: await toPublicUserWithShellMode(user, session.activeProjectKey, session.activeClientId)
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
  return { expiresAt: session.expiresAt.toISOString(), user: await toPublicUserWithShellMode(user, project.projectKey, project.clientId) };
}

async function toPublicUserWithShellMode(user: AuthUser, activeProjectKey?: string, activeClientId?: string) {
  const publicUser = toPublicUser(user, activeProjectKey, activeClientId);
  const clientIds = Array.from(new Set(publicUser.projects.map((project) => project.clientId).filter(Boolean))) as string[];

  const projectDocs = (await Promise.all(clientIds.map((clientId) => projectsRepo.listProjectsByClient(clientId)))).flat();
  const shellModeByProject = new Map(
    projectDocs.map((project) => [`${project.clientId}:${project.projectKey}`, project.standaloneB2bEnabled === true ? "b2b" : "b2c"] as const)
  );

  const projects = publicUser.projects.map((project) => ({
    ...project,
    shellMode: project.clientId ? shellModeByProject.get(`${project.clientId}:${project.projectKey}`) ?? "b2c" : project.shellMode ?? "b2c"
  }));

  const activeProject = projects.find(
    (project) => project.projectKey === publicUser.activeProjectKey && (!publicUser.activeClientId || project.clientId === publicUser.activeClientId)
  );

  return {
    ...publicUser,
    activeProjectShellMode: activeProject?.shellMode,
    projects
  };
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
