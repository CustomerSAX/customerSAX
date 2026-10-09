"use client";

import { useEffect, useState } from "react";

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
 * Client-side session and organization context lookup, mirroring Customer CX Studio's
 * conventions (/api/auth/me).
 *
 * When authenticated, returns the user and their associated organization identity and uiTheme.
 * When unauthenticated (such as in standalone fixture demo mode), gracefully returns user: null
 * without blocking UI rendering or breaking demo behavior.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        if (!cancelled && payload?.user?.email) {
          setUser({
            ...payload.user,
            projects: payload.user.projects ?? [],
            requiresProjectSelection: Boolean(payload.user.requiresProjectSelection)
          } as CurrentUser);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[useCurrentUser] session lookup error (expected in unauthenticated standalone demo mode):", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, reload: () => window.location.reload() };
}

export function roleLabel(role: CurrentUser["role"]): string {
  const labels: Record<CurrentUser["role"], string> = {
    agent: "CSA Agent",
    admin: "CSA Administrator",
    superadmin: "CSA Super Administrator"
  };

  return labels[role];
}
