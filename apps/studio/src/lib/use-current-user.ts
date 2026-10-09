"use client";


export type CurrentUser = {
  email: string;
  id: string;
  name: string;
  role: "agent" | "admin" | "superadmin";
  tenantId: string;
  activeClientId?: string;
  activeProjectKey?: string;
  activeProjectShellMode?: "b2c" | "b2b";
  projectKey?: string;
  projects: Array<{ clientId?: string; displayName?: string; projectKey: string; role: string; shellMode?: "b2c" | "b2b" }>;
  requiresProjectSelection: boolean;
  uiTheme?: string;
  organization?: {
    id?: string;
    name?: string;
    slug?: string;
    uiTheme?: string;
  };
};

/**
 * Client-side counterpart to lib/get-current-user.ts's server-side session
 * lookup — same /api/auth/me endpoint (which itself reads the csa_session
 * cookie and calls the real auth service), just usable from "use client"
 * components that can't await a server-side call.
 *
 * Returns `user: null` while the fetch is in flight or if it fails — callers
 * must treat that as "identity not yet known" and either wait or show that
 * honestly, never substitute a fabricated identity for it.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const CURRENT_USER_QUERY_KEY = ["currentUser"] as const;

export function useCurrentUser() {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading: loading } = useQuery<CurrentUser | null>({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      if (payload?.user?.email) {
        return {
          ...payload.user,
          projects: payload.user.projects ?? [],
          requiresProjectSelection: Boolean(payload.user.requiresProjectSelection)
        } as CurrentUser;
      }
      return null;
    },
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
    gcTime: 15 * 60 * 1000,
  });

  return {
    user,
    loading,
    reload: () => {
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      window.location.reload();
    }
  };
}

/** Human-readable label for a role, shared by AppShell's topbar and the CSA Assistant's session context. */
export function roleLabel(role: CurrentUser["role"]): string {
  const labels: Record<CurrentUser["role"], string> = {
    agent: "CSA Agent",
    admin: "CSA Administrator",
    superadmin: "CSA Super Administrator"
  };

  return labels[role];
}
