import { authServiceUrl, currentSessionToken, ensureDefaultProjectSelection } from '@/app/api/auth/shared';

export type CurrentUser = {
  email: string;
  id: string;
  name: string;
  projectKey?: string;
  activeClientId?: string;
  activeProjectKey?: string;
  activeProjectShellMode?: 'b2c' | 'b2b';
  projects?: Array<{ clientId?: string; displayName?: string; projectKey: string; role: string; shellMode?: 'b2c' | 'b2b' }>;
  requiresProjectSelection?: boolean;
  role: 'agent' | 'admin' | 'superadmin';
  tenantId: string;
  uiTheme?: string;
  organization?: {
    id?: string;
    name?: string;
    slug?: string;
    uiTheme?: string;
  };
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await currentSessionToken();

  if (!token && process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === '1') {
    const projectKey =
      process.env.NEXT_PUBLIC_CT_PROJECT_KEY?.trim() ||
      process.env.COMMERCETOOLS_PROJECT_KEY?.trim() ||
      undefined;
    return {
      email: 'dev@csa.local',
      id: 'dev-user',
      name: 'Dev User',
      role: 'agent',
      tenantId: 'dev',
      activeProjectKey: projectKey,
      projectKey,
    };
  }

  if (!token) return null;

  try {
    const response = await fetch(`${authServiceUrl()}/sessions/current`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as { user?: CurrentUser } | null;
    return (await ensureDefaultProjectSelection(token, payload?.user)) ?? null;
  } catch (error) {
    console.error('[get-current-user] failed to reach auth service:', error);
    return null;
  }
}
