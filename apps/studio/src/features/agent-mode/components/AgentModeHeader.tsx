"use client";

import { Icon, Button } from "@csa/ui";
import { useCurrentUser } from "@/lib/use-current-user";
import { useRouter } from "next/navigation";

interface AgentModeHeaderProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isWorkspaceOpen?: boolean;
  onToggleWorkspace?: () => void;
  priorityCount?: number;
}

export function AgentModeHeader({
  isSidebarOpen = true,
  onToggleSidebar,
  isWorkspaceOpen = false,
  onToggleWorkspace,
  priorityCount = 0,
}: AgentModeHeaderProps) {
  const router = useRouter();
  const { user } = useCurrentUser();

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-m-border bg-m-surface px-3 sm:px-4 select-none shrink-0 z-10">
      {/* ── Left Branding & Sidebar Toggle ── */}
      <div className="flex items-center gap-2.5">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Collapse sidebar" : "Open conversation history"}
            className="p-1.5 rounded-md text-m-text-muted hover:text-m-text hover:bg-m-surface-2 transition cursor-pointer"
          >
            <Icon name={isSidebarOpen ? "panel-left-close" : "panel-left"} size="sm" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-2xs">
            <Icon name="sparkles" size="sm" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-m-text">
            CustomerX <span className="font-normal text-m-text-muted">Agent Mode</span>
          </span>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
          AI Conversational Workspace
        </span>

        {user?.activeProjectKey && (
          <span className="hidden md:inline-flex items-center gap-1 rounded border border-m-border bg-m-surface-2 px-2 py-0.5 text-[11px] text-m-text-muted">
            <Icon name="folder" size="xs" />
            Project: <strong className="font-medium text-m-text">{user.activeProjectKey}</strong>
          </span>
        )}
      </div>

      {/* ── Right Actions ── */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Restrained Top-Right Control to open the Priority Workspace on demand */}
        {onToggleWorkspace && (
          <Button
            variant={isWorkspaceOpen ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleWorkspace}
            className={`flex items-center gap-1.5 text-xs font-medium transition cursor-pointer ${
              isWorkspaceOpen
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "text-m-text hover:bg-m-surface-2"
            }`}
          >
            <Icon name="list" size="xs" />
            <span className="hidden sm:inline">Priority Workspace</span>
            <span className="sm:hidden">Queue</span>
            {priorityCount > 0 && (
              <span className="ml-0.5 rounded-full bg-indigo-600 text-white px-1.5 py-0.2 text-[10px] font-semibold leading-tight">
                {priorityCount}
              </span>
            )}
          </Button>
        )}

        {user?.name && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-m-text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate max-w-[120px]">{user.name}</span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1 text-xs text-m-text font-medium hover:bg-m-surface-2"
        >
          <Icon name="arrow-left" size="xs" />
          <span className="hidden sm:inline">Return to Studio</span>
          <span className="sm:hidden">Studio</span>
        </Button>
      </div>
    </header>
  );
}
