/**
 * Server-side session lookup for the superadmin feature.
 *
 * This is intentionally NOT a new auth mechanism — it reuses the exact
 * cookie + auth-service contract that api/auth/{login,logout,me}/route.ts
 * already established (see ../app/api/auth/shared.ts): read the
 * `csa_session` cookie, exchange it for the current user by calling
 * `${AUTH_SERVICE_URL}/sessions/current` with a Bearer token. Nothing here
 * talks to MongoDB or changes how login/logout/session issuance works.
 */

import { authServiceUrl, currentSessionToken } from '@/app/api/auth/shared';

export type CurrentUser = {
  email: string;
  id: string;
  name: string;
  projectKey?: string;
  activeClientId?: string;
  activeProjectKey?: string;
  projects?: Array<{ clientId?: string; displayName?: string; projectKey: string; role: string }>;
  requiresProjectSelection?: boolean;
  role: 'agent' | 'admin' | 'superadmin';
  tenantId: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = currentSessionToken();
  if (!token) return null;

  try {
    const response = await fetch(`${authServiceUrl()}/sessions/current`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as { user?: CurrentUser } | null;
    return payload?.user ?? null;
  } catch (error) {
    console.error('[get-current-user] failed to reach auth service:', error);
    return null;
  }
}
