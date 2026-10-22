"use client";

import { Icon, Button } from "@csa/ui";
import { useCurrentUser } from "@/lib/use-current-user";
import { useRouter } from "next/navigation";

export function AgentModeHeader() {
  const router = useRouter();
  const { user } = useCurrentUser();

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-m-border bg-m-surface px-4 select-none shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-sm">
            <Icon name="sparkles" size="sm" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-m-text">
            CustomerX <span className="font-normal text-m-text-muted">Agent Mode</span>
          </span>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
          AI-First Workspace
        </span>

        {user?.activeProjectKey && (
          <span className="hidden md:inline-flex items-center gap-1 rounded border border-m-border bg-m-surface-2 px-2 py-0.5 text-[11px] text-m-text-muted">
            <Icon name="folder" size="xs" />
            Project: <strong className="font-medium text-m-text">{user.activeProjectKey}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user?.name && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-m-text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>{user.name}</span>
            <span className="rounded bg-m-surface-2 px-1.5 py-0.2 text-[10px] uppercase font-semibold text-m-text-muted">
              {user.role}
            </span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-m-text font-medium hover:bg-m-surface-2"
        >
          <Icon name="arrow-left" size="xs" />
          <span>Return to Studio</span>
        </Button>
      </div>
    </header>
  );
}
