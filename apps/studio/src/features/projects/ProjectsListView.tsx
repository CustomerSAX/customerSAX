"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Badge,
  Button,
  Icon,
  Input
} from "@csa/ui";
import { AppShell } from "@/components/shell/AppShell";
import { useCurrentUser } from "@/lib/use-current-user";
import { ADMIN_CLIENT_QUERY } from "@/features/superadmin/api/queries";
import { CreateProjectModal } from "./CreateProjectModal";
import { ProjectConfigureModal } from "./ProjectConfigureModal";
import Link from "next/link";

export function ProjectsListView({ embedded }: { embedded?: boolean } = {}) {
  const { user, loading: userLoading } = useCurrentUser();
  const clientId = user?.activeClientId || user?.organization?.id;
  const isOrgAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [configuringProject, setConfiguringProject] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data, loading, error, refetch } = useQuery(ADMIN_CLIENT_QUERY, {
    variables: { id: clientId },
    skip: !clientId || !isOrgAdmin,
    fetchPolicy: "cache-first"
  });

  const client = data?.adminClient;
  const projects: any[] = data?.adminProjectsByClient || [];

  const filteredProjects = projects.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      (p.displayName && p.displayName.toLowerCase().includes(term)) ||
      (p.projectKey && p.projectKey.toLowerCase().includes(term)) ||
      (p.platform && p.platform.toLowerCase().includes(term))
    );
  });

  const handleSwitchProject = async (targetProjectKey: string) => {
    try {
      const res = await fetch("/api/auth/switch-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectKey: targetProjectKey, clientId })
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      }
    } catch {
      // Fallback
      window.location.reload();
    }
  };

  const content = (
    <div className={embedded ? "space-y-6" : "space-y-6 p-6"}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {!embedded && (
            <p className="text-xs font-bold uppercase tracking-widest text-m-primary">
              Organization / Projects
            </p>
          )}
          <h2 className={embedded ? "text-lg font-bold text-m-text" : "text-2xl font-bold text-m-text"}>
            {client?.name ? `${client.name} Projects` : "Projects"}
          </h2>
          <p className="mt-0.5 text-xs text-m-text-muted">
            Manage your commerce environments, platform credentials, and connector configurations.
          </p>
        </div>
        {isOrgAdmin && (
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <Icon name="plus" size="sm" />
            <span>Create Project</span>
          </Button>
        )}
      </div>

      {/* Search & Filter */}
        {projects.length > 0 && (
          <div className="flex items-center justify-between gap-4">
            <div className="w-full max-w-sm">
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-sm text-m-text-muted">
              {filteredProjects.length} of {projects.length} project{projects.length === 1 ? "" : "s"}
            </div>
          </div>
        )}

        {/* Content States */}
        {userLoading || loading ? (
          <div className="flex items-center justify-center rounded-xl border border-m-border bg-m-surface p-12 text-sm text-m-text-muted">
            <Icon name="loader" className="mr-2 animate-spin" size="sm" />
            Loading projects...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-600 dark:text-red-400">
            Error loading projects: {error.message}
          </div>
        ) : projects.length === 0 ? (
          /* Empty State - Requirement 4 */
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-m-border bg-m-surface/40 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-m-primary/10 text-m-primary mb-4">
              <Icon name="folder-plus" size="lg" />
            </div>
            <h3 className="text-lg font-bold text-m-text">No projects found</h3>
            <p className="mt-1 max-w-md text-sm text-m-text-muted">
              No projects have been configured for this organization yet. Create your first project to connect your commerce platform and start managing your customer operations.
            </p>
            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2"
              >
                <Icon name="plus" size="sm" />
                <span>Create Your First Project</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((proj) => {
              const isActive = user?.activeProjectKey === proj.projectKey;
              const isConfigured = proj.isConfigured !== false && proj.status !== "setup_required";

              return (
                <div
                  key={proj.id || proj.projectKey}
                  className={`flex flex-col justify-between rounded-xl border bg-m-surface p-5 transition-all shadow-sm ${
                    isActive ? "border-m-primary ring-1 ring-m-primary/20" : "border-m-border hover:border-m-text-muted/30"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-m-text text-base">
                            {proj.displayName || proj.projectKey}
                          </span>
                          {isActive && (
                            <Badge variant="primary" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-xs text-m-text-muted mt-0.5">
                          {proj.projectKey}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {isConfigured ? (
                          <Badge variant="success" className="text-xs">
                            Configured
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">
                            Setup Required
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="space-y-2 py-3 border-y border-m-border/60 text-xs">
                      <div className="flex items-center justify-between text-m-text-muted">
                        <span>Platform</span>
                        <span className="font-semibold text-m-text capitalize">
                          {proj.platform || "commercetools"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-m-text-muted">
                        <span>Experience Mode</span>
                        <span className="font-medium text-m-text uppercase">
                          {proj.standaloneB2bEnabled ? "B2B" : "B2C"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-m-text-muted">
                        <span>Ticketing</span>
                        <span className="font-medium text-m-text capitalize">
                          {proj.ticketingProvider || "internal"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-2 flex flex-wrap items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant={isConfigured ? "outline" : "primary"}
                      onClick={() => setConfiguringProject(proj)}
                      className="flex items-center gap-1.5"
                    >
                      <Icon name="settings" size="xs" />
                      <span>{isConfigured ? "Edit Platform" : "Configure Platform"}</span>
                    </Button>

                    <Link href={`/admin-settings/connectors`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1.5"
                      >
                        <Icon name="link" size="xs" />
                        <span>Connectors</span>
                      </Button>
                    </Link>

                    {!isActive && isConfigured && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSwitchProject(proj.projectKey)}
                      >
                        Switch To
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

  const modals = (
    <>
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />

      <ProjectConfigureModal
        isOpen={Boolean(configuringProject)}
        onClose={() => setConfiguringProject(null)}
        project={configuringProject}
        onSuccess={() => {
          setConfiguringProject(null);
          refetch();
        }}
      />
    </>
  );

  if (embedded) {
    return (
      <>
        {content}
        {modals}
      </>
    );
  }

  return (
    <AppShell>
      {content}
      {modals}
    </AppShell>
  );
}
