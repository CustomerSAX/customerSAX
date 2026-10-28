"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apolloClient } from "@/graphql/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { isProjectPage, projectFromUrl, projectHref, projectPath } from "@/lib/project-url";
import { ProjectLoading } from "./ProjectLoading";

/** Resolve a shared URL's project before mounting components that fetch data. */
export function ProjectUrlBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<{ url: string; message: string } | null>(null);
  const scoped = isProjectPage(pathname);
  const requestedKey = projectPath(pathname).projectKey;
  const requestedClient = searchParams.get("client");
  const url = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
  const mismatch = Boolean(scoped && requestedKey && user && (requestedKey !== user.activeProjectKey || (requestedClient && requestedClient !== user.activeClientId)));
  const target = useMemo(() => mismatch && user ? projectFromUrl(user.projects, requestedKey!, requestedClient) : null, [mismatch, user, requestedKey, requestedClient]);
  const denied = mismatch && !target;

  useEffect(() => {
    if (!scoped || loading || !user) return;
    if (!requestedKey || !mismatch) {
      if (!user.activeProjectKey || user.requiresProjectSelection) return;
      const canonical = projectHref(`${url}${window.location.hash}`, { projectKey: user.activeProjectKey, clientId: user.activeClientId }, user.projects);
      if (canonical !== `${url}${window.location.hash}`) window.history.replaceState(null, "", canonical);
      return;
    }
    if (!target) return;
    let cancelled = false;
    async function selectProject() {
      try {
        const response = await fetch("/api/auth/project", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(target)
        });
        if (!response.ok) throw new Error("Unable to select the project in this link. Check your access and retry.");
        if (cancelled) return;
        await apolloClient.clearStore().catch(() => undefined);
        if (cancelled) return;
        queryClient.clear();
        window.location.assign(`${url}${window.location.hash}`);
      } catch (cause) {
        if (!cancelled) setFailure({ url, message: cause instanceof Error ? cause.message : "Unable to select this project." });
      }
    }
    void selectProject();
    return () => { cancelled = true; };
  }, [scoped, loading, user, requestedKey, mismatch, target, url, queryClient]);

  if (scoped && (denied || (failure?.url === url && mismatch))) {
    return <div role="alert" className="mx-auto max-w-xl space-y-4 p-8 text-m-text">
      <p>{denied ? "This project link is unavailable or ambiguous for your account." : failure?.message}</p>
      {user?.activeProjectKey && <a className="text-blue-600 underline" href={projectHref(pathname, { projectKey: user.activeProjectKey, clientId: user.activeClientId }, user.projects)}>Continue with your current project</a>}
    </div>;
  }
  if (scoped && (loading || mismatch)) return <ProjectLoading />;
  return children;
}
