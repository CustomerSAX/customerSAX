import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const sessionCookieName = process.env.AUTH_COOKIE_NAME?.trim() || "csa_session";

export type SessionProject = {
  clientId?: string;
  displayName?: string;
  projectKey: string;
  role: string;
  shellMode?: "b2c" | "b2b";
};

export type SessionUserWithProjects = {
  activeClientId?: string;
  activeProjectKey?: string;
  activeProjectShellMode?: "b2c" | "b2b";
  projectKey?: string;
  projects?: SessionProject[];
  requiresProjectSelection?: boolean;
};

export function authServiceUrl() {
  return process.env.AUTH_SERVICE_URL?.trim() || "http://127.0.0.1:4360";
}

type CachedSession = {
  session: Record<string, any>;
  cachedAt: number;
};

const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 30_000; // 30 seconds safe TTL

export async function getValidatedSession(token: string): Promise<Record<string, any> | null> {
  const cached = sessionCache.get(token);
  if (cached && Date.now() - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    return { ...cached.session };
  }

  const response = await fetch(`${authServiceUrl()}/sessions/current`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (!response.ok) {
    sessionCache.delete(token);
    return null;
  }

  const session = (await response.json().catch(() => ({}))) as Record<string, any>;
  sessionCache.set(token, { session, cachedAt: Date.now() });
  return { ...session };
}

export function invalidateSessionCache(token?: string) {
  if (token) sessionCache.delete(token);
  else sessionCache.clear();
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set(sessionCookieName, token, {
    expires: new Date(expiresAt),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse, token?: string) {
  if (token) invalidateSessionCache(token);
  else invalidateSessionCache();
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function currentSessionToken() {
  return (await cookies()).get(sessionCookieName)?.value;
}

export async function ensureDefaultProjectSelection<T extends SessionUserWithProjects & Record<string, any>>(
  token: string,
  user: T | null | undefined
): Promise<T | null | undefined> {
  if (!user) return user;
  if (user.activeProjectKey && user.activeClientId) return user;

  const defaultProject =
    user.projects?.find((project) => project.projectKey && project.clientId) ||
    user.projects?.find((project) => project.projectKey);
  if (!defaultProject) {
    if (!user.activeClientId && (user.organization?.id || (user.tenantId && user.tenantId !== "csa"))) {
      return {
        ...user,
        activeClientId: user.organization?.id || user.tenantId,
        requiresProjectSelection: false
      };
    }
    return user;
  }

  const clientId =
    defaultProject.clientId ||
    user.projects?.find((p) => p.projectKey === defaultProject.projectKey && p.clientId)?.clientId ||
    user.projects?.find((p) => p.clientId)?.clientId;

  try {
    const response = await fetch(`${authServiceUrl()}/sessions/current/project`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ projectKey: defaultProject.projectKey, clientId }),
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => null)) as { user?: T } | null;
    if (response.ok && payload?.user) return payload.user;
  } catch (error) {
    console.error("[auth] failed to select default project:", error);
  }

  return {
    ...user,
    activeClientId: clientId,
    activeProjectKey: defaultProject.projectKey,
    activeProjectShellMode: defaultProject.shellMode,
    projectKey: defaultProject.projectKey,
    requiresProjectSelection: false
  };
}

export async function enrichUserWithOrganizationTheme<T extends Record<string, any>>(
  user: T | null | undefined
): Promise<T | null | undefined> {
  if (!user) return user;
  if (user.uiTheme && user.organization) return user;

  return user;
}


