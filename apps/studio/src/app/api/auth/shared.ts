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
  return process.env.AUTH_SERVICE_URL?.trim() || "http://localhost:4360";
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

export function clearSessionCookie(response: NextResponse) {
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

export async function ensureDefaultProjectSelection<T extends SessionUserWithProjects>(
  token: string,
  user: T | null | undefined
): Promise<T | null | undefined> {
  if (!user || user.activeProjectKey) return user;

  const defaultProject = user.projects?.find((project) => project.projectKey);
  if (!defaultProject) return user;

  try {
    const response = await fetch(`${authServiceUrl()}/sessions/current/project`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ projectKey: defaultProject.projectKey, clientId: defaultProject.clientId }),
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => null)) as { user?: T } | null;
    if (response.ok && payload?.user) return payload.user;
  } catch (error) {
    console.error("[auth] failed to select default project:", error);
  }

  return {
    ...user,
    activeClientId: defaultProject.clientId,
    activeProjectKey: defaultProject.projectKey,
    activeProjectShellMode: defaultProject.shellMode,
    projectKey: defaultProject.projectKey,
    requiresProjectSelection: false
  };
}
