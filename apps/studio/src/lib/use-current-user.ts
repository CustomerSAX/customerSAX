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
  projectKey?: string;
  projects: Array<{ clientId?: string; displayName?: string; projectKey: string; role: string }>;
  requiresProjectSelection: boolean;
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

/** Human-readable label for a role, shared by AppShell's topbar and the CSA Assistant's session context. */
export function roleLabel(role: CurrentUser["role"]): string {
  const labels: Record<CurrentUser["role"], string> = {
    agent: "CSA Agent",
    admin: "CSA Administrator",
    superadmin: "CSA Super Administrator"
  };

  return labels[role];
}
