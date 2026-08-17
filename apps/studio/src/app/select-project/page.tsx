"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apolloClient } from "@/graphql/client";
import { useCurrentUser } from "@/lib/use-current-user";

function safeCallback(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function SelectProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useCurrentUser();
  const [submitting, setSubmitting] = useState("");
  const [error, setError] = useState("");

  async function selectProject(projectKey: string, clientId?: string) {
    setSubmitting(projectKey);
    setError("");
    try {
      const response = await fetch("/api/auth/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectKey, clientId })
      });
      if (!response.ok) throw new Error(response.status === 403 ? "You no longer have access to this project." : "Unable to select project.");
      await apolloClient.clearStore();
      router.replace(safeCallback(searchParams.get("callbackUrl")));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to select project.");
    } finally {
      setSubmitting("");
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-m-surface-bg text-sm text-m-text-muted">Loading your projects…</main>;
  if (!user) return <main className="flex min-h-screen items-center justify-center bg-m-surface-bg"><a href="/login" className="font-semibold text-m-primary">Return to sign in</a></main>;

  return (
    <main className="min-h-screen bg-m-surface-bg px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-m-primary">CSA Workspace</div>
          <h1 className="mt-3 text-3xl font-extrabold text-m-text">Select a project</h1>
          <p className="mt-2 text-m-text-muted">Choose the commerce project you want to work in. You can switch again from the top bar.</p>
        </div>
        {error && <div className="mb-5 rounded-xl border border-m-error-border bg-m-error-light px-4 py-3 text-sm font-semibold text-m-error-dark">{error}</div>}
        {user.projects.length === 0 ? (
          <div className="rounded-2xl border border-m-border bg-m-surface-1 p-10 text-center shadow-m-sm">
            <h2 className="font-bold text-m-text">No project access</h2>
            <p className="mt-2 text-sm text-m-text-muted">Ask an administrator to assign at least one project to your account.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {user.projects.map((project) => (
              <button key={`${project.clientId ?? "legacy"}:${project.projectKey}`} type="button" onClick={() => void selectProject(project.projectKey, project.clientId)} disabled={Boolean(submitting)} className="rounded-2xl border border-m-border bg-m-surface-1 p-6 text-left shadow-m-sm transition hover:-translate-y-0.5 hover:border-m-primary hover:shadow-m-md disabled:opacity-60">
                <div className="text-lg font-extrabold text-m-text">{project.displayName || project.projectKey}</div>
                <div className="mt-1 font-mono text-xs text-m-text-muted">{project.projectKey}</div>
                <div className="mt-5 inline-flex rounded-full bg-m-primary-50 px-3 py-1 text-xs font-bold text-m-primary-700">{project.role}</div>
                {submitting === project.projectKey && <div className="mt-3 text-xs font-semibold text-m-primary">Opening workspace…</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SelectProjectPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-m-surface-bg" />}>
      <SelectProjectContent />
    </Suspense>
  );
}
