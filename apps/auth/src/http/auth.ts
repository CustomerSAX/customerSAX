import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { createLogger } from "@csa/logger";
import { findClientById, findClientBySlug, listProjectsByClient } from "@csa/mongodb";
import { createSessionToken, hashSessionToken } from "../security/tokens.js";
import { verifyPassword } from "../security/passwords.js";
import {
  createSession,
  findActiveSessionByTokenHash,
  findUserByEmail,
  findUserById,
  revokeSessionByTokenHash,
  setSessionProject
} from "../users/repository.js";
import { projectsForUser, toPublicUser, type PublicUser } from "../users/types.js";

const log = createLogger("auth");

async function enrichUserWithOrg(publicUser: PublicUser, tenantId?: string): Promise<PublicUser> {
  const clientId = publicUser.activeClientId || (tenantId && tenantId !== "csa" ? tenantId : undefined);

  let client = null;
  if (clientId) {
    try {
      client = (await findClientById(clientId)) || (await findClientBySlug(clientId));
    } catch {
      // ignore
    }
  }

  // If still not found, check if any project in user.projects has a valid clientId
  if (!client && publicUser.projects) {
    for (const proj of publicUser.projects) {
      if (proj.clientId) {
        try {
          client = await findClientById(proj.clientId);
          if (client) {
            if (!publicUser.activeClientId) publicUser.activeClientId = proj.clientId;
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // If still not found, check email domain (e.g., tahsin.raza@royalcyber.com -> royalcyber)
  if (!client && publicUser.email) {
    const domainMatch = publicUser.email.split("@")[1]?.split(".")[0]?.toLowerCase();
    if (domainMatch && domainMatch !== "csa" && domainMatch !== "gmail" && domainMatch !== "yahoo") {
      try {
        client = await findClientBySlug(domainMatch);
      } catch {
        // ignore
      }
    }
  }

  if (client) {
    const resolvedClientId = client._id?.toHexString ? client._id.toHexString() : String(client._id || clientId);
    const theme = client.uiTheme || "csa-custom";
    publicUser.uiTheme = theme;
    publicUser.organization = {
      id: resolvedClientId,
      name: client.name,
      slug: client.slug,
      uiTheme: theme
    };
    if (!publicUser.activeClientId) {
      publicUser.activeClientId = resolvedClientId;
    }

    // Organization Admin: automatically has access to all projects belonging to the organization
    if (publicUser.role === "admin") {
      try {
        const orgProjects = await listProjectsByClient(resolvedClientId);
        publicUser.projects = orgProjects.map((p) => ({
          clientId: resolvedClientId,
          projectKey: p.projectKey,
          displayName: p.displayName,
          role: "admin",
          shellMode: p.standaloneB2bEnabled ? "b2b" : "b2c"
        }));
        if (!publicUser.activeProjectKey && publicUser.projects.length > 0) {
          publicUser.activeProjectKey = publicUser.projects[0].projectKey;
          publicUser.activeProjectShellMode = publicUser.projects[0].shellMode;
          publicUser.projectKey = publicUser.projects[0].projectKey;
        } else if (publicUser.activeProjectKey) {
          const activeProj = publicUser.projects.find((p) => p.projectKey === publicUser.activeProjectKey);
          if (activeProj) {
            publicUser.activeProjectShellMode = activeProj.shellMode;
          }
        }
      } catch (err) {
        log.warn("failed to list projects for org admin", { err });
      }
    }
  }

  return publicUser;
}



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
  const defaultProject =
    onlyProject ||
    (user.projectKey
      ? projects.find((p) => p.projectKey === user.projectKey && p.clientId) ||
        projects.find((p) => p.projectKey === user.projectKey)
      : undefined) ||
    projects.find((p) => p.clientId);
  let activeProjectKey = defaultProject?.projectKey;
  const activeClientId = defaultProject?.clientId || (user as any).clientId || (user.tenantId !== "csa" ? user.tenantId : undefined);

  if (user.role === "admin" && activeClientId && !activeProjectKey) {
    try {
      const orgProjects = await listProjectsByClient(activeClientId);
      if (orgProjects.length > 0) {
        activeProjectKey = orgProjects[0].projectKey;
      }
    } catch {
      // ignore
    }
  }

  await createSession({
    createdAt: now,
    expiresAt,
    id: randomUUID(),
    tokenHash: hashSessionToken(token),
    userId: user.id || String(user._id ?? user.email),
    activeProjectKey,
    activeClientId
  });

  const publicUser = await enrichUserWithOrg(
    toPublicUser(user, activeProjectKey, activeClientId),
    user.tenantId
  );

  return {
    expiresAt: expiresAt.toISOString(),
    token,
    user: publicUser
  };
}

export async function loginWithSso(email: string) {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlSeconds() * 1000);

  const projects = projectsForUser(user);
  const onlyProject = projects.length === 1 ? projects[0] : undefined;
  const defaultProject =
    onlyProject ||
    (user.projectKey
      ? projects.find((p) => p.projectKey === user.projectKey && p.clientId) ||
        projects.find((p) => p.projectKey === user.projectKey)
      : undefined) ||
    projects.find((p) => p.clientId);
  let activeProjectKey = defaultProject?.projectKey;
  const activeClientId = defaultProject?.clientId || (user as any).clientId || (user.tenantId !== "csa" ? user.tenantId : undefined);

  if (user.role === "admin" && activeClientId && !activeProjectKey) {
    try {
      const orgProjects = await listProjectsByClient(activeClientId);
      if (orgProjects.length > 0) {
        activeProjectKey = orgProjects[0].projectKey;
      }
    } catch {
      // ignore
    }
  }

  await createSession({
    createdAt: now,
    expiresAt,
    id: randomUUID(),
    tokenHash: hashSessionToken(token),
    userId: user.id || String(user._id ?? user.email),
    activeProjectKey,
    activeClientId
  });

  const publicUser = await enrichUserWithOrg(
    toPublicUser(user, activeProjectKey, activeClientId),
    user.tenantId
  );

  return {
    expiresAt: expiresAt.toISOString(),
    token,
    user: publicUser
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

  const publicUser = await enrichUserWithOrg(
    toPublicUser(user, session.activeProjectKey, session.activeClientId),
    user.tenantId
  );

  return {
    expiresAt: session.expiresAt.toISOString(),
    user: publicUser
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

  let effectiveClientId = clientId || session.activeClientId || (user as any).clientId || (user.tenantId !== "csa" ? user.tenantId : undefined);

  let allowed = false;

  // Organization Admin: automatically has access to all projects in the organization
  if (user.role === "admin" && effectiveClientId) {
    try {
      const orgProjects = await listProjectsByClient(effectiveClientId);
      const orgMatch = orgProjects.find((p) => p.projectKey === projectKey);
      if (orgMatch) {
        allowed = true;
      }
    } catch {
      // ignore
    }
  }

  if (!allowed) {
    const matchingProjects = projectsForUser(user).filter((candidate) => candidate.projectKey === projectKey);
    const project = clientId
      ? matchingProjects.find((candidate) => candidate.clientId === clientId)
      : matchingProjects.length === 1
        ? matchingProjects[0]
        : matchingProjects.find((candidate) => candidate.clientId) || matchingProjects[0];
    if (project) {
      allowed = true;
      effectiveClientId = project.clientId || effectiveClientId || projectsForUser(user).find((p) => p.clientId)?.clientId;
    }
  }

  if (!allowed) return { forbidden: true as const };

  await setSessionProject(tokenHash, projectKey, effectiveClientId);
  log.child({ module: "auth" }).info("active project changed", {
    userId: user.id || String(user._id),
    projectKey: projectKey,
    clientId: effectiveClientId
  });
  const publicUser = await enrichUserWithOrg(
    toPublicUser(user, projectKey, effectiveClientId),
    user.tenantId
  );
  return { expiresAt: session.expiresAt.toISOString(), user: publicUser };
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
