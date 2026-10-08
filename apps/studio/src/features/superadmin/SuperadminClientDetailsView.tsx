"use client";

import { useMutation, useQuery } from "@apollo/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  LoadingSpinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@csa/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ADMIN_CLIENT_QUERY,
  ADMIN_SET_CLIENT_STATUS
} from "./api/queries";

interface SuperadminClientDetailsViewProps {
  organizationId: string;
}

export function SuperadminClientDetailsView({ organizationId }: SuperadminClientDetailsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"projects" | "users" | "connectors">("projects");
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const { data, loading, error, refetch } = useQuery(ADMIN_CLIENT_QUERY, {
    variables: { id: organizationId },
    fetchPolicy: "network-only"
  });

  const [setClientStatus] = useMutation(ADMIN_SET_CLIENT_STATUS);

  const client = data?.adminClient;
  const projects = data?.adminProjectsByClient ?? [];
  const users = data?.adminUsersByClient ?? [];
  const smtpProfiles = data?.adminSmtpProfilesByClient ?? [];
  const aiSettings = data?.adminAiSettings;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="mx-auto max-w-4xl py-12 px-4">
        <EmptyState
          icon="alert-triangle"
          title="Couldn't load client organization"
          description={error?.message || "Organization not found."}
          action={
            <Button variant="secondary" size="sm" onClick={() => router.push("/superadmin/clients")}>
              Back to Client Organisations
            </Button>
          }
        />
      </div>
    );
  }

  const handleToggleStatus = async () => {
    const nextStatus = client.status === "active" ? "blocked" : "active";
    setIsTogglingStatus(true);
    try {
      await setClientStatus({ variables: { id: client.id, status: nextStatus } });
      await refetch();
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const adminUsers = users.filter((u: any) => u.role === "admin");
  const memberUsers = users.filter((u: any) => u.role !== "admin");

  const configuredProjects = projects.filter((p: any) => p.isConfigured !== false && p.status !== "setup_required");
  const setupRequiredProjects = projects.filter((p: any) => p.isConfigured === false || p.status === "setup_required");

  // Determine overall onboarding status
  const overallSetupStatus =
    projects.length === 0
      ? { label: "Setup Required: No Projects", variant: "warning" as const, desc: "Organization provisioned. Awaiting project creation by Organization Admin." }
      : setupRequiredProjects.length > 0
        ? { label: "Setup Required: Project Configuration", variant: "warning" as const, desc: "Initial project created. Awaiting commerce platform credentials from Organization Admin." }
        : { label: "Active & Configured", variant: "success" as const, desc: "Organization is fully operational with active commerce projects." };

  // Collect configured platforms
  const platformsUsed = Array.from(new Set(projects.map((p: any) => p.platform || "commercetools")));

  // Connectors count
  let connectorsCount = 0;
  if (aiSettings?.enabled) connectorsCount++;
  if (smtpProfiles.length > 0) connectorsCount++;
  const customTicketing = projects.some((p: any) => p.ticketingProvider && p.ticketingProvider !== "internal");
  if (customTicketing) connectorsCount++;

  return (
    <div className="mx-auto max-w-5xl py-6 px-4 space-y-6">
      {/* Header Breadcrumbs / Back */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/superadmin/clients")}
          leftIcon={<Icon name="arrow-left" size="xs" />}
          className="text-m-text-muted hover:text-m-text"
        >
          All Client Organisations
        </Button>
        <div className="flex items-center gap-2">
          <Badge
            variant={client.status === "active" ? "success" : "error"}
            appearance="subtle"
            size="sm"
            dot
            className="uppercase tracking-wider"
          >
            {client.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleToggleStatus()}
            disabled={isTogglingStatus}
            loading={isTogglingStatus}
          >
            {client.status === "active" ? "Block Tenant" : "Activate Tenant"}
          </Button>
        </div>
      </div>

      {/* Organization Header Card */}
      <div className="rounded-m-xl border border-m-border bg-m-surface p-6 shadow-m-card space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-m-primary">
              Client Organisation Details
            </div>
            <h1 className="text-2xl font-extrabold text-m-text tracking-tight mt-0.5">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-m-text-muted">
              <span className="font-mono bg-m-neutral-100 px-2 py-0.5 rounded border border-m-border">
                {client.slug}
              </span>
              <span>•</span>
              <span>Contact: <strong className="text-m-text">{client.contactEmail}</strong></span>
              <span>•</span>
              <span>Created: {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "—"}</span>
              <span>•</span>
              <span>Theme: <strong className="text-m-text">{client.uiTheme || "csa-custom"}</strong></span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <Badge variant={overallSetupStatus.variant} appearance="subtle" size="sm" dot>
              {overallSetupStatus.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 bg-m-surface border-m-border">
          <div className="text-[11px] font-bold uppercase text-m-text-muted">Total Projects</div>
          <div className="text-2xl font-black text-m-text mt-1">{projects.length}</div>
          <div className="text-[10px] text-m-text-muted mt-0.5">
            {configuredProjects.length} configured, {setupRequiredProjects.length} setup required
          </div>
        </Card>

        <Card className="p-4 bg-m-surface border-m-border">
          <div className="text-[11px] font-bold uppercase text-m-text-muted">Users & Admins</div>
          <div className="text-2xl font-black text-m-text mt-1">{users.length}</div>
          <div className="text-[10px] text-m-text-muted mt-0.5">
            {adminUsers.length} admin{adminUsers.length === 1 ? "" : "s"}, {memberUsers.length} member{memberUsers.length === 1 ? "" : "s"}
          </div>
        </Card>

        <Card className="p-4 bg-m-surface border-m-border">
          <div className="text-[11px] font-bold uppercase text-m-text-muted">Commerce Platforms</div>
          <div className="text-lg font-bold text-m-text mt-1 capitalize truncate">
            {platformsUsed.length > 0 ? platformsUsed.join(", ") : "None configured"}
          </div>
          <div className="text-[10px] text-m-text-muted mt-0.5">Managed by customer admin</div>
        </Card>

        <Card className="p-4 bg-m-surface border-m-border">
          <div className="text-[11px] font-bold uppercase text-m-text-muted">Active Connectors</div>
          <div className="text-2xl font-black text-m-text mt-1">{connectorsCount}</div>
          <div className="text-[10px] text-m-text-muted mt-0.5">
            AI: {aiSettings?.enabled ? "Yes" : "Native"}, SMTP: {smtpProfiles.length > 0 ? "Yes" : "Native"}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-m-border flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 ${activeTab === "projects"
              ? "border-m-primary text-m-primary"
              : "border-transparent text-m-text-muted hover:text-m-text"
            }`}
        >
          Commerce Projects ({projects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 ${activeTab === "users"
              ? "border-m-primary text-m-primary"
              : "border-transparent text-m-text-muted hover:text-m-text"
            }`}
        >
          Team & Administrators ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("connectors")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 ${activeTab === "connectors"
              ? "border-m-primary text-m-primary"
              : "border-transparent text-m-text-muted hover:text-m-text"
            }`}
        >
          Connectors & Integrations Metadata
        </button>
      </div>

      {/* TAB 1: Projects */}
      {activeTab === "projects" && (
        <Card className="border-m-border bg-m-surface overflow-hidden shadow-m-card">
          {projects.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="briefcase"
                title="No projects configured yet"
                description="This organization has zero projects. The Organization Admin will create and configure their first project from customerSAX Studio."
              />
            </div>
          ) : (
            <Table className="border-0 shadow-none rounded-none">
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Project Key</TableHead>
                  <TableHead>Commerce Platform</TableHead>
                  <TableHead>Shell Mode</TableHead>
                  <TableHead>Ticketing</TableHead>
                  <TableHead>Setup Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p: any) => {
                  const isConfigured = p.isConfigured !== false && p.status !== "setup_required";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold text-m-text">{p.displayName || p.projectKey}</TableCell>
                      <TableCell className="font-mono text-[11px] text-m-text-muted">{p.projectKey}</TableCell>
                      <TableCell>
                        <span className="capitalize font-medium text-xs text-m-text">
                          {p.platform || "commercetools"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" appearance="subtle" size="sm" className="uppercase font-mono text-[10px]">
                          {p.standaloneB2bEnabled ? "B2B" : "B2C"}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize text-xs text-m-text-muted">
                        {p.ticketingProvider || "internal"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isConfigured ? "success" : "warning"}
                          appearance="subtle"
                          size="sm"
                          dot
                        >
                          {isConfigured ? "Configured" : "Setup Required"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* TAB 2: Users & Access */}
      {activeTab === "users" && (
        <Card className="border-m-border bg-m-surface overflow-hidden shadow-m-card">
          {users.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="users"
                title="No users provisioned"
                description="No users exist for this organization tenant."
              />
            </div>
          ) : (
            <Table className="border-0 shadow-none rounded-none">
              <TableHeader>
                <TableRow>
                  <TableHead>User / Rep</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Projects</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold text-m-text">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="font-medium text-xs text-m-text">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "admin" ? "primary" : "neutral"}
                        appearance="subtle"
                        size="sm"
                      >
                        {u.role === "admin" ? "Organization Admin" : u.role || "Member"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.clientProjects && u.clientProjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.clientProjects.map((cp: any) => (
                            <span
                              key={cp.projectKey}
                              className="font-mono text-[10px] bg-m-neutral-100 px-1.5 py-0.5 rounded border border-m-border"
                            >
                              {cp.projectKey}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-m-text-muted italic">All (Org Level)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.active !== false ? "success" : "neutral"}
                        appearance="subtle"
                        size="sm"
                        dot
                      >
                        {u.active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* TAB 3: Connectors & Integrations Metadata */}
      {activeTab === "connectors" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* AI Assistant */}
            <Card className="p-5 border-m-border bg-m-surface shadow-m-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-m-md bg-m-primary text-white">
                    <Icon name="sparkles" size="sm" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-m-text">AI Assistant</h3>
                    <p className="text-[11px] text-m-text-muted">Copilot intelligence provider</p>
                  </div>
                </div>
                <Badge
                  variant={aiSettings?.enabled ? "success" : "neutral"}
                  appearance="subtle"
                  size="sm"
                  dot
                >
                  {aiSettings?.enabled ? "Enabled" : "Native / Disabled"}
                </Badge>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-m-text-muted">Provider:</span>
                  <span className="font-semibold text-m-text capitalize">{aiSettings?.provider || "Native"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-m-text-muted">Model:</span>
                  <span className="font-mono text-m-text">{aiSettings?.model || "default"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-m-text-muted">API Key Stored:</span>
                  <span className="font-medium text-m-text">{aiSettings?.apiKeySet ? "Yes (Encrypted)" : "No"}</span>
                </div>
              </div>
            </Card>

            {/* SMTP Communication */}
            <Card className="p-5 border-m-border bg-m-surface shadow-m-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-m-md bg-m-neutral-100 text-m-text">
                    <Icon name="mail" size="sm" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-m-text">SMTP Email Relay</h3>
                    <p className="text-[11px] text-m-text-muted">Transactional communication relay</p>
                  </div>
                </div>
                <Badge
                  variant={smtpProfiles.length > 0 ? "success" : "neutral"}
                  appearance="subtle"
                  size="sm"
                  dot
                >
                  {smtpProfiles.length > 0 ? "Configured" : "Default CSA Relay"}
                </Badge>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-3 text-xs space-y-1.5">
                {smtpProfiles.length > 0 ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-m-text-muted">Host:</span>
                      <span className="font-mono text-m-text">{smtpProfiles[0].smtpHost}:{smtpProfiles[0].smtpPort}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-m-text-muted">From Email:</span>
                      <span className="font-medium text-m-text">{smtpProfiles[0].emailFrom}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-m-text-muted">Credentials:</span>
                      <span className="text-m-text">Secure (Isolated in MongoDB)</span>
                    </div>
                  </>
                ) : (
                  <div className="text-m-text-muted italic py-1">
                    No custom SMTP profile. Using default application mailer.
                  </div>
                )}
              </div>
            </Card>

            {/* Ticketing Connectors */}
            <Card className="p-5 border-m-border bg-m-surface shadow-m-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-m-md bg-m-neutral-100 text-m-text">
                    <Icon name="life-buoy" size="sm" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-m-text">Ticketing System</h3>
                    <p className="text-[11px] text-m-text-muted">Customer support ticketing bridge</p>
                  </div>
                </div>
                <Badge
                  variant={customTicketing ? "primary" : "neutral"}
                  appearance="subtle"
                  size="sm"
                >
                  {customTicketing ? "Third-Party" : "Native CSA Ticketing"}
                </Badge>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-m-text-muted">Provider:</span>
                  <span className="font-semibold text-m-text capitalize">
                    {projects[0]?.ticketingProvider || "internal (Native)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-m-text-muted">OAuth Credentials:</span>
                  <span className="text-m-text">Customer Managed (Studio)</span>
                </div>
              </div>
            </Card>

            {/* Search Integration */}
            <Card className="p-5 border-m-border bg-m-surface shadow-m-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-m-md bg-m-neutral-100 text-m-text">
                    <Icon name="search" size="sm" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-m-text">Product Search</h3>
                    <p className="text-[11px] text-m-text-muted">Catalog search & discovery engine</p>
                  </div>
                </div>
                <Badge variant="neutral" appearance="subtle" size="sm">
                  Active
                </Badge>
              </div>

              <div className="rounded-m-lg border border-m-border bg-m-neutral-50 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-m-text-muted">Primary Search:</span>
                  <span className="font-semibold text-m-text">Platform Native & Algolia Connectable</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-m-text-muted">Search API Keys:</span>
                  <span className="text-m-text">Customer Managed (Studio)</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
