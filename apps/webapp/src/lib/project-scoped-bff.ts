import { authServiceUrl, currentSessionToken } from "@/app/api/auth/shared";

type SessionPayload = {
  user?: {
    activeClientId?: string;
    activeProjectKey?: string;
    requiresProjectSelection?: boolean;
    role?: string;
  };
};

export class ProjectSessionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Calls the federated BFF with project identity derived from the server-side
 * session. Callers cannot override these headers with browser-supplied values.
 */
export async function projectScopedBffFetch(url: string, init: RequestInit = {}) {
  const token = currentSessionToken();
  if (!token) throw new ProjectSessionError("Authentication required", 401);

  const sessionResponse = await fetch(`${authServiceUrl()}/sessions/current`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!sessionResponse.ok) throw new ProjectSessionError("Authentication required", 401);

  const session = (await sessionResponse.json()) as SessionPayload;
  const user = session.user;
  if (!user) throw new ProjectSessionError("Authentication required", 401);
  if (!user.activeProjectKey && user.role !== "superadmin") {
    throw new ProjectSessionError("Select a project before loading workspace data", 409);
  }

  const headers = new Headers(init.headers);
  if (user.activeProjectKey) headers.set("x-csa-project-key", user.activeProjectKey);
  if (user.activeClientId) headers.set("x-csa-client-id", user.activeClientId);

  return fetch(url, { ...init, headers, cache: "no-store" });
}
