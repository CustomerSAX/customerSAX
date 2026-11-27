"use client";

import { useMutation, useQuery } from "@apollo/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  LoadingSpinner,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
  ADMIN_SET_CLIENT_STATUS,
  ADMIN_DELETE_CLIENT,
  ADMIN_DELETE_PROJECT,
  ADMIN_CREATE_CLIENT_USER,
  ADMIN_UPDATE_CLIENT_USER,
  ADMIN_REMOVE_USER_FROM_CLIENT
} from "./api/queries";
import { CreateProjectModal } from "@/features/projects/CreateProjectModal";
import { ProjectConfigureModal } from "@/features/projects/ProjectConfigureModal";
import { notify } from "@/features/notifications/notification-store";

interface SuperadminClientDetailsViewProps {
  organizationId: string;
}

interface ClientUserRow {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isOrgAdmin?: boolean;
  active: boolean;
  clientProjects: Array<{
    projectKey: string;
    role: string;
  }>;
}

export function SuperadminClientDetailsView({
  organizationId
}: SuperadminClientDetailsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"projects" | "users">("projects");
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Project Modals State
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [configuringProject, setConfiguringProject] = useState<any | null>(null);
  const [deletingProject, setDeletingProject] = useState<any | null>(null);
  const [deleteProjectConfirmKey, setDeleteProjectConfirmKey] = useState("");
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);

  // Organization Deletion State
  const [isDeleteOrgOpen, setIsDeleteOrgOpen] = useState(false);
  const [deleteOrgConfirmName, setDeleteOrgConfirmName] = useState("");
  const [deleteOrgError, setDeleteOrgError] = useState<string | null>(null);

  // User Management Modals State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "agent">("agent");
  const [createSelectedProjects, setCreateSelectedProjects] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [editingUser, setEditingUser] = useState<ClientUserRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "agent">("agent");
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editSelectedProjects, setEditSelectedProjects] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [removingUser, setRemovingUser] = useState<ClientUserRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemovingUser, setIsRemovingUser] = useState(false);

  const { data, loading, error, refetch } = useQuery(ADMIN_CLIENT_QUERY, {
    variables: { id: organizationId },
    fetchPolicy: "cache-first"
  });

  const [setClientStatus] = useMutation(ADMIN_SET_CLIENT_STATUS);
  const [deleteClientMutation, { loading: isDeletingOrg }] = useMutation(ADMIN_DELETE_CLIENT);
  const [deleteProjectMutation, { loading: isDeletingProject }] = useMutation(ADMIN_DELETE_PROJECT);
  const [createClientUser] = useMutation(ADMIN_CREATE_CLIENT_USER);
  const [updateClientUser] = useMutation(ADMIN_UPDATE_CLIENT_USER);
  const [removeUserFromClient] = useMutation(ADMIN_REMOVE_USER_FROM_CLIENT);

  const handleDeleteOrg = async () => {
    setDeleteOrgError(null);
    try {
      await deleteClientMutation({ variables: { id: organizationId } });
      router.push("/superadmin/clients");
    } catch (err: any) {
      setDeleteOrgError(err.message || "Failed to delete organization");
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    setDeleteProjectError(null);
    try {
      await deleteProjectMutation({ variables: { id: deletingProject.id } });
      setDeletingProject(null);
      setDeleteProjectConfirmKey("");
      await refetch();
    } catch (err: any) {
      setDeleteProjectError(err.message || "Failed to delete project");
    }
  };

  const client = data?.adminClient;
  const projects = data?.adminProjectsByClient ?? [];
  const uniqueProjects = projects.filter(
    (p: any, index: number, self: any[]) =>
      Boolean(p.projectKey) &&
      index ===
        self.findIndex(
          (t: any) =>
            t.projectKey &&
            t.projectKey.toLowerCase() === p.projectKey?.toLowerCase()
        )
  );
  const users: ClientUserRow[] = data?.adminUsersByClient ?? [];

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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/superadmin/clients")}
            >
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

  const adminUsers = users.filter((u) => u.role === "admin");
  const memberUsers = users.filter((u) => u.role !== "admin");

  const configuredProjects = projects.filter(
    (p: any) => p.isConfigured !== false && p.status !== "setup_required"
  );
  const setupRequiredProjects = projects.filter(
    (p: any) => p.isConfigured === false || p.status === "setup_required"
  );

  const overallSetupStatus =
    projects.length === 0
      ? {
          label: "Setup Required: No Projects",
          variant: "warning" as const,
          desc: "Organization provisioned. Awaiting project creation by Organization Admin or Superadmin."
        }
      : setupRequiredProjects.length > 0
        ? {
            label: "Setup Required: Project Configuration",
            variant: "warning" as const,
            desc: "Project created. Awaiting commerce platform credentials configuration."
          }
        : {
            label: "Active & Configured",
            variant: "success" as const,
            desc: "Organization is fully operational with active commerce projects."
          };

  // --- Handlers for User Management ---
  const handleOpenCreateUser = () => {
    setCreateFirstName("");
    setCreateLastName("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("agent");
    setCreateSelectedProjects(uniqueProjects.length > 0 ? [uniqueProjects[0].projectKey] : []);
    setCreateError(null);
    setIsCreateUserOpen(true);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingUser) return;
    setCreateError(null);

    const emailClean = createEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes("@")) {
      setCreateError("Please enter a valid email address.");
      return;
    }
    if (createPassword.length < 8) {
      setCreateError("Password must be at least 8 characters long.");
      return;
    }
    if (uniqueProjects.length > 0 && createSelectedProjects.length === 0) {
      setCreateError("Select at least one project for this user.");
      return;
    }

    setIsCreatingUser(true);
    try {
      await createClientUser({
        variables: {
          clientId: organizationId,
          grantedBy: "superadmin",
          input: {
            email: emailClean,
            password: createPassword,
            firstName: createFirstName.trim() || undefined,
            lastName: createLastName.trim() || undefined,
            role: createRole,
            projects: createSelectedProjects.map((pk) => ({ projectKey: pk, role: createRole }))
          }
        }
      });
      setIsCreateUserOpen(false);
      notify({
        variant: "success",
        title: "User added",
        description: `User "${emailClean}" added successfully.`
      });
      await refetch();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleOpenEditUser = (user: ClientUserRow) => {
    setEditingUser(user);
    setEditFirstName(user.firstName || "");
    setEditLastName(user.lastName || "");
    setEditPassword("");
    setEditRole((user.role === "admin" ? "admin" : "agent") as "admin" | "agent");
    setEditActive(user.active !== false);
    setEditSelectedProjects(
      user.clientProjects ? user.clientProjects.map((cp) => cp.projectKey) : []
    );
    setEditError(null);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingUser) return;
    if (!editingUser) return;
    setEditError(null);

    if (editPassword && editPassword.trim() && editPassword.trim().length < 8) {
      setEditError("Password must be at least 8 characters long if provided.");
      return;
    }
    const isTargetOrgAdmin = Boolean(editingUser.isOrgAdmin);
    if (!isTargetOrgAdmin && uniqueProjects.length > 0 && editSelectedProjects.length === 0) {
      setEditError("Select at least one project for this user.");
      return;
    }

    setIsSavingUser(true);
    try {
      await updateClientUser({
        variables: {
          clientId: organizationId,
          grantedBy: "superadmin",
          input: {
            email: editingUser.email,
            firstName: editFirstName.trim() || undefined,
            lastName: editLastName.trim() || undefined,
            password: editPassword.trim() ? editPassword.trim() : undefined,
            role: isTargetOrgAdmin ? "admin" : editRole,
            active: isTargetOrgAdmin ? true : editActive,
            projects: isTargetOrgAdmin
              ? []
              : editSelectedProjects.map((pk) => ({ projectKey: pk, role: editRole }))
          }
        }
      });
      const updatedEmail = editingUser.email;
      setEditingUser(null);
      notify({
        variant: "success",
        title: "User updated",
        description: `User "${updatedEmail}" updated successfully.`
      });
      await refetch();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleRemoveUserSubmit = async () => {
    if (isRemovingUser) return;
    if (!removingUser) return;
    setRemoveError(null);
    setIsRemovingUser(true);
    try {
      await removeUserFromClient({
        variables: {
          clientId: organizationId,
          email: removingUser.email
        }
      });
      const removedEmail = removingUser.email;
      setRemovingUser(null);
      notify({
        variant: "success",
        title: "User removed",
        description: `User "${removedEmail}" removed successfully.`
      });
      await refetch();
    } catch (err: unknown) {
      setRemoveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRemovingUser(false);
    }
  };

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
            <h1 className="text-2xl font-extrabold text-m-text tracking-tight mt-0.5">
              {client.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-m-text-muted">
              <span className="font-mono bg-m-neutral-100 px-2 py-0.5 rounded border border-m-border">
                {client.slug}
              </span>
              <span>•</span>
              <span>
                Contact: <strong className="text-m-text">{client.contactEmail}</strong>
              </span>
              <span>•</span>
              <span>
                Created:{" "}
                {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "—"}
              </span>
              <span>•</span>
              <span>
                Theme:{" "}
                <strong className="text-m-text">{client.uiTheme || "csa-custom"}</strong>
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <Badge variant={overallSetupStatus.variant} appearance="subtle" size="sm" dot>
              {overallSetupStatus.label}
            </Badge>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setIsDeleteOrgOpen(true);
                setDeleteOrgConfirmName("");
                setDeleteOrgError(null);
              }}
              leftIcon={<Icon name="trash-2" size="xs" />}
            >
              Delete Organization
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards: Keep only Total Projects and Users & Admins */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-4 bg-m-surface border-m-border">
          <div className="text-[11px] font-bold uppercase text-m-text-muted">
            Total Projects
          </div>
          <div className="text-2xl font-black text-m-text mt-1">{projects.length}</div>
          <div className="text-[10px] text-m-text-muted mt-0.5">
            {configuredProjects.length} configured, {setupRequiredProjects.length} setup
            required
          </div>
        </Card>

        <Card className="p-4 bg-m-surface border-m-border">
          <div className="text-[11px] font-bold uppercase text-m-text-muted">
            Users & Admins
          </div>
          <div className="text-2xl font-black text-m-text mt-1">{users.length}</div>
          <div className="text-[10px] text-m-text-muted mt-0.5">
            {adminUsers.length} admin{adminUsers.length === 1 ? "" : "s"},{" "}
            {memberUsers.length} member{memberUsers.length === 1 ? "" : "s"}
          </div>
        </Card>
      </div>

      {/* Tabs: Keep Commerce Projects and Team & Administrators */}
      <div className="border-b border-m-border flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("projects")}
            className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
              activeTab === "projects"
                ? "border-m-primary text-m-primary"
                : "border-transparent text-m-text-muted hover:text-m-text"
            }`}
          >
            Commerce Projects ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
              activeTab === "users"
                ? "border-m-primary text-m-primary"
                : "border-transparent text-m-text-muted hover:text-m-text"
            }`}
          >
            Team & Administrators ({users.length})
          </button>
        </div>

        {activeTab === "projects" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateProjectOpen(true)}
            leftIcon={<Icon name="plus" size="xs" />}
            className="mb-2"
          >
            Create Project
          </Button>
        )}

        {activeTab === "users" && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateUser}
            leftIcon={<Icon name="plus" size="xs" />}
            className="mb-2"
          >
            Add User
          </Button>
        )}
      </div>

      {/* TAB 1: Projects */}
      {activeTab === "projects" && (
        <Card className="border-m-border bg-m-surface overflow-hidden shadow-m-card">
          {projects.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="briefcase"
                title="No projects configured yet"
                description="This organization has zero projects. Create a new project to get started."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateProjectOpen(true)}
                    leftIcon={<Icon name="plus" size="xs" />}
                  >
                    Create Project
                  </Button>
                }
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p: any) => {
                  const isConfigured =
                    p.isConfigured !== false && p.status !== "setup_required";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold text-m-text">
                        {p.displayName || p.projectKey}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-m-text-muted">
                        {p.projectKey}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize font-medium text-xs text-m-text">
                          {p.platform || "commercetools"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="neutral"
                          appearance="subtle"
                          size="sm"
                          className="uppercase font-mono text-[10px]"
                        >
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfiguringProject(p)}
                            leftIcon={<Icon name="edit" size="xs" />}
                          >
                            Configure
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingProject(p);
                              setDeleteProjectConfirmKey("");
                              setDeleteProjectError(null);
                            }}
                            className="text-m-error hover:bg-m-error/10 hover:text-m-error"
                            leftIcon={<Icon name="trash-2" size="xs" />}
                          >
                            Delete
                          </Button>
                        </div>
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
                description="No users exist for this organization tenant. Add a user or administrator to get started."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOpenCreateUser}
                    leftIcon={<Icon name="plus" size="xs" />}
                  >
                    Add User
                  </Button>
                }
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold text-m-text">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="font-medium text-xs text-m-text">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      {u.isOrgAdmin ? (
                        <Badge variant="primary" appearance="subtle" size="sm">
                          Organization Admin
                        </Badge>
                      ) : u.role === "admin" ? (
                        <Badge variant="primary" appearance="outline" size="sm">
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="neutral" appearance="subtle" size="sm">
                          Member / Agent
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.isOrgAdmin ? (
                        <span className="text-xs text-m-text-muted italic">
                          All Projects (Org Level)
                        </span>
                      ) : u.clientProjects && u.clientProjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.clientProjects.map((cp) => (
                            <span
                              key={cp.projectKey}
                              className="font-mono text-[10px] bg-m-neutral-100 px-1.5 py-0.5 rounded border border-m-border"
                            >
                              {cp.projectKey}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-m-text-muted italic">
                          No Projects Assigned
                        </span>
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditUser(u)}
                          leftIcon={<Icon name="edit" size="xs" />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRemovingUser(u);
                            setRemoveError(null);
                          }}
                          className="text-m-error hover:bg-m-error-50"
                          leftIcon={<Icon name="trash" size="xs" />}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* --- CREATE PROJECT MODAL --- */}
      {isCreateProjectOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          clientId={organizationId}
          onClose={() => setIsCreateProjectOpen(false)}
          onSuccess={() => {
            setIsCreateProjectOpen(false);
            void refetch();
          }}
        />
      )}

      {/* --- EDIT / CONFIGURE PROJECT MODAL --- */}
      {configuringProject && (
        <ProjectConfigureModal
          isOpen={Boolean(configuringProject)}
          project={configuringProject}
          onClose={() => setConfiguringProject(null)}
          onSuccess={() => {
            void refetch();
          }}
        />
      )}

      {/* --- CREATE USER MODAL --- */}
      <Modal isOpen={isCreateUserOpen} onClose={() => setIsCreateUserOpen(false)} size="md">
        <ModalHeader
          title={`Add User to ${client.name}`}
          onClose={() => setIsCreateUserOpen(false)}
        />
        <form onSubmit={handleCreateUserSubmit}>
          <ModalBody>
            <div className="space-y-4">
              {createError && (
                <div className="rounded-m-md border border-m-error-200 bg-m-error-50 p-3 text-xs text-m-error flex items-start gap-2">
                  <Icon name="alert-triangle" size="xs" className="shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={createFirstName}
                    onChange={(e) => setCreateFirstName(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Morgan"
                    value={createLastName}
                    onChange={(e) => setCreateLastName(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">
                  Password * (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-2">Role *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-m-md border cursor-pointer transition-colors flex items-start gap-2.5 ${
                      createRole === "admin"
                        ? "border-m-primary bg-m-primary-50/40"
                        : "border-m-border bg-m-surface hover:bg-m-neutral-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="createRole"
                      value="admin"
                      checked={createRole === "admin"}
                      onChange={() => setCreateRole("admin")}
                      className="mt-0.5 text-m-primary focus:ring-m-primary"
                    />
                    <div>
                      <div className="text-xs font-bold text-m-text">Admin</div>
                      <div className="text-[11px] text-m-text-muted mt-0.5">
                        Full access to assigned projects and Studio Admin Settings.
                      </div>
                    </div>
                  </label>
                  <label
                    className={`p-3 rounded-m-md border cursor-pointer transition-colors flex items-start gap-2.5 ${
                      createRole === "agent"
                        ? "border-m-primary bg-m-primary-50/40"
                        : "border-m-border bg-m-surface hover:bg-m-neutral-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="createRole"
                      value="agent"
                      checked={createRole === "agent"}
                      onChange={() => setCreateRole("agent")}
                      className="mt-0.5 text-m-primary focus:ring-m-primary"
                    />
                    <div>
                      <div className="text-xs font-bold text-m-text">Member / CSA Agent</div>
                      <div className="text-[11px] text-m-text-muted mt-0.5">
                        Scoped project access to assigned commerce projects.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Project Selection */}
              <div className="space-y-2 pt-2 border-t border-m-border">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-m-text">
                    Project Access *
                  </label>
                  {uniqueProjects.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setCreateSelectedProjects(uniqueProjects.map((p: any) => p.projectKey.trim()))
                        }
                        className="text-m-primary hover:underline"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setCreateSelectedProjects([])}
                        className="text-m-text-muted hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {uniqueProjects.length === 0 ? (
                  <div className="rounded-m-md border border-m-border bg-m-neutral-50 p-3 text-xs text-m-text-muted italic">
                    No projects currently exist for this organization. You can create a project first or assign projects to this user later.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-m-md border border-m-border p-2 bg-m-neutral-50">
                    {uniqueProjects.map((p: any) => {
                      const pKey = (p.projectKey || "").trim();
                      const isSelected = createSelectedProjects.includes(pKey);
                      const inputId = `create-user-project-${p.id || pKey}`;
                      return (
                        <div
                          key={p.id || pKey}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs ${
                            isSelected
                              ? "bg-white border border-m-primary-200 shadow-sm"
                              : "hover:bg-white/60 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              id={inputId}
                              type="checkbox"
                              value={pKey}
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCreateSelectedProjects((prev) =>
                                  checked
                                    ? prev.includes(pKey)
                                      ? prev
                                      : [...prev, pKey]
                                    : prev.filter((k) => k !== pKey)
                                );
                              }}
                              className="rounded text-m-primary focus:ring-m-primary cursor-pointer"
                            />
                            <label
                              htmlFor={inputId}
                              className="font-medium text-m-text cursor-pointer select-none"
                            >
                              {p.displayName || pKey}
                            </label>
                          </div>
                          <span className="font-mono text-[10px] text-m-text-muted bg-m-neutral-100 px-1.5 py-0.5 rounded border border-m-border">
                            {pKey}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateUserOpen(false)}
              disabled={isCreatingUser}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isCreatingUser}
              disabled={isCreatingUser}
            >
              Create User
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* --- EDIT USER MODAL --- */}
      <Modal isOpen={Boolean(editingUser)} onClose={() => setEditingUser(null)} size="md">
        <ModalHeader
          title={`Edit User: ${editingUser?.email}`}
          onClose={() => setEditingUser(null)}
        />
        <form onSubmit={handleEditUserSubmit}>
          <ModalBody>
            <div className="space-y-4">
              {editError && (
                <div className="rounded-m-md border border-m-error-200 bg-m-error-50 p-3 text-xs text-m-error flex items-start gap-2">
                  <Icon name="alert-triangle" size="xs" className="shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-m-text mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={editingUser?.email || ""}
                  className="w-full rounded-m-md border border-m-border bg-m-neutral-100 px-3 py-2 text-xs text-m-text-muted cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-m-text mb-1">
                  Change Password (optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep unchanged (min. 8 characters)"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text outline-none focus:border-m-primary"
                />
              </div>

              {/* Status Toggle */}
              <div>
                <label className="block text-xs font-bold text-m-text mb-1">Account Status</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editActive"
                      checked={editActive === true}
                      onChange={() => setEditActive(true)}
                      className="text-m-primary focus:ring-m-primary"
                    />
                    <span className="font-medium text-m-text">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editActive"
                      checked={editActive === false}
                      onChange={() => setEditActive(false)}
                      className="text-m-primary focus:ring-m-primary"
                    />
                    <span className="font-medium text-m-text">Inactive (Suspended)</span>
                  </label>
                </div>
              </div>

              {/* Role Display / Selection */}
              <div>
                <label className="block text-xs font-bold text-m-text mb-2">Role</label>
                {editingUser?.isOrgAdmin ? (
                  <div className="p-3 rounded-m-md border border-m-primary bg-m-primary-50/40 flex items-start gap-3">
                    <Badge variant="primary" appearance="subtle" size="sm" className="mt-0.5 shrink-0">
                      Org Admin
                    </Badge>
                    <div>
                      <div className="text-xs font-bold text-m-text">
                        Organization Admin (Org Admin)
                      </div>
                      <div className="text-[11px] text-m-text-muted mt-0.5">
                        Established during onboarding with automatic access to all current and future projects in this organization.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`p-3 rounded-m-md border cursor-pointer transition-colors flex items-start gap-2.5 ${
                        editRole === "admin"
                          ? "border-m-primary bg-m-primary-50/40"
                          : "border-m-border bg-m-surface hover:bg-m-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="editRole"
                        value="admin"
                        checked={editRole === "admin"}
                        onChange={() => setEditRole("admin")}
                        className="mt-0.5 text-m-primary focus:ring-m-primary"
                      />
                      <div>
                        <div className="text-xs font-bold text-m-text">Admin</div>
                        <div className="text-[11px] text-m-text-muted mt-0.5">
                          Full access to assigned projects and Studio Admin Settings.
                        </div>
                      </div>
                    </label>
                    <label
                      className={`p-3 rounded-m-md border cursor-pointer transition-colors flex items-start gap-2.5 ${
                        editRole === "agent"
                          ? "border-m-primary bg-m-primary-50/40"
                          : "border-m-border bg-m-surface hover:bg-m-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="editRole"
                        value="agent"
                        checked={editRole === "agent"}
                        onChange={() => setEditRole("agent")}
                        className="mt-0.5 text-m-primary focus:ring-m-primary"
                      />
                      <div>
                        <div className="text-xs font-bold text-m-text">Member / CSA Agent</div>
                        <div className="text-[11px] text-m-text-muted mt-0.5">
                          Scoped project access to assigned commerce projects.
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Project Access */}
              {editingUser?.isOrgAdmin ? (
                <div className="rounded-m-lg border border-m-primary-200 bg-m-primary-50 p-3 text-xs text-m-primary flex items-start gap-2">
                  <Icon name="sparkles" size="xs" className="shrink-0 mt-0.5" />
                  <span>
                    <strong>Automatic Org-Wide Access:</strong> Organization Admins automatically receive access to all current and future projects in {client.name}. Manual project assignments are not required.
                  </span>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-m-border">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-m-text">
                      Project Access *
                    </label>
                    {uniqueProjects.length > 0 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setEditSelectedProjects(uniqueProjects.map((p: any) => p.projectKey.trim()))
                          }
                          className="text-m-primary hover:underline"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setEditSelectedProjects([])}
                          className="text-m-text-muted hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {uniqueProjects.length === 0 ? (
                    <div className="rounded-m-md border border-m-border bg-m-neutral-50 p-3 text-xs text-m-text-muted italic">
                      No projects currently exist for this organization.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-m-md border border-m-border p-2 bg-m-neutral-50">
                      {uniqueProjects.map((p: any) => {
                        const pKey = (p.projectKey || "").trim();
                        const isSelected = editSelectedProjects.includes(pKey);
                        const inputId = `edit-user-project-${p.id || pKey}`;
                        return (
                          <div
                            key={p.id || pKey}
                            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? "bg-white border border-m-primary-200 shadow-sm"
                                : "hover:bg-white/60 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                id={inputId}
                                type="checkbox"
                                value={pKey}
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEditSelectedProjects((prev) =>
                                    checked
                                      ? prev.includes(pKey)
                                        ? prev
                                        : [...prev, pKey]
                                      : prev.filter((k) => k !== pKey)
                                  );
                                }}
                                className="rounded text-m-primary focus:ring-m-primary cursor-pointer"
                              />
                              <label
                                htmlFor={inputId}
                                className="font-medium text-m-text cursor-pointer select-none"
                              >
                                {p.displayName || pKey}
                              </label>
                            </div>
                            <span className="font-mono text-[10px] text-m-text-muted bg-m-neutral-100 px-1.5 py-0.5 rounded border border-m-border">
                              {pKey}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingUser(null)}
              disabled={isSavingUser}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSavingUser}
              disabled={isSavingUser}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* --- REMOVE USER MODAL --- */}
      <Modal isOpen={Boolean(removingUser)} onClose={() => setRemovingUser(null)} size="sm">
        <ModalHeader
          title="Remove User from Organization"
          onClose={() => setRemovingUser(null)}
        />
        <ModalBody>
          <div className="space-y-3 text-xs text-m-text">
            {removeError && (
              <div className="rounded-m-md border border-m-error-200 bg-m-error-50 p-3 text-xs text-m-error flex items-start gap-2">
                <Icon name="alert-triangle" size="xs" className="shrink-0 mt-0.5" />
                <span>{removeError}</span>
              </div>
            )}
            <p>
              Are you sure you want to remove{" "}
              <strong className="font-bold text-m-text">{removingUser?.email}</strong> from{" "}
              <strong className="font-bold text-m-text">{client.name}</strong>?
            </p>
            <p className="text-m-text-muted">
              This will revoke this user&apos;s access to all projects in this organization.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRemovingUser(null)}
            disabled={isRemovingUser}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={isRemovingUser}
            disabled={isRemovingUser}
            onClick={() => void handleRemoveUserSubmit()}
          >
            Remove User
          </Button>
        </ModalFooter>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Project Deletion Confirmation Modal                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {deletingProject && (
        <Modal
          isOpen={Boolean(deletingProject)}
          onClose={() => {
            if (!isDeletingProject) {
              setDeletingProject(null);
              setDeleteProjectConfirmKey("");
              setDeleteProjectError(null);
            }
          }}
          size="sm"
        >
          <ModalHeader
            title="Delete Project"
            subtitle="Permanently delete project and platform configuration"
            onClose={() => {
              if (!isDeletingProject) {
                setDeletingProject(null);
                setDeleteProjectConfirmKey("");
                setDeleteProjectError(null);
              }
            }}
          />
          <ModalBody>
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                <p className="font-semibold">Warning: This will permanently delete the project:</p>
                <p className="mt-1 font-mono font-bold text-sm text-m-text">
                  {deletingProject.displayName || deletingProject.projectKey} ({deletingProject.projectKey})
                </p>
                <p className="mt-2 text-[11px] text-m-text-muted">
                  All commerce credentials, platform configuration, ticketing connections, and associated settings will be permanently removed. This action cannot be undone.
                </p>
              </div>

              {deleteProjectError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                  {deleteProjectError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-m-text mb-1">
                  Type <span className="font-mono font-bold text-red-600">{deletingProject.projectKey}</span> to confirm:
                </label>
                <Input
                  value={deleteProjectConfirmKey}
                  onChange={(e) => setDeleteProjectConfirmKey(e.target.value)}
                  placeholder={deletingProject.projectKey}
                  disabled={isDeletingProject}
                  autoFocus
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeletingProject(null);
                  setDeleteProjectConfirmKey("");
                  setDeleteProjectError(null);
                }}
                disabled={isDeletingProject}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeletingProject || deleteProjectConfirmKey !== deletingProject.projectKey}
                loading={isDeletingProject}
                onClick={handleDeleteProject}
                leftIcon={<Icon name="trash-2" size="xs" />}
              >
                Delete Project
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Organization Deletion Confirmation Modal                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isDeleteOrgOpen && (
        <Modal
          isOpen={isDeleteOrgOpen}
          onClose={() => {
            if (!isDeletingOrg) {
              setIsDeleteOrgOpen(false);
              setDeleteOrgConfirmName("");
              setDeleteOrgError(null);
            }
          }}
          size="sm"
        >
          <ModalHeader
            title="Delete Organization"
            subtitle="Permanently remove organization and all associated data"
            onClose={() => {
              if (!isDeletingOrg) {
                setIsDeleteOrgOpen(false);
                setDeleteOrgConfirmName("");
                setDeleteOrgError(null);
              }
            }}
          />
          <ModalBody>
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                <p className="font-semibold">Warning: This will permanently delete:</p>
                <p className="mt-1 font-bold text-sm text-m-text">
                  {client?.name || "This organization"} ({client?.slug})
                </p>
                <p className="mt-2 text-[11px] text-m-text-muted">
                  All {projects.length} project(s), connectors, credentials, and access for all members will be permanently deleted. This action cannot be undone.
                </p>
              </div>

              {deleteOrgError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                  {deleteOrgError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-m-text mb-1">
                  Type <span className="font-bold text-red-600">{client?.name}</span> to confirm:
                </label>
                <Input
                  value={deleteOrgConfirmName}
                  onChange={(e) => setDeleteOrgConfirmName(e.target.value)}
                  placeholder={client?.name}
                  disabled={isDeletingOrg}
                  autoFocus
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsDeleteOrgOpen(false);
                  setDeleteOrgConfirmName("");
                  setDeleteOrgError(null);
                }}
                disabled={isDeletingOrg}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeletingOrg || deleteOrgConfirmName !== client?.name}
                loading={isDeletingOrg}
                onClick={handleDeleteOrg}
                leftIcon={<Icon name="trash-2" size="xs" />}
              >
                Delete Organization
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
