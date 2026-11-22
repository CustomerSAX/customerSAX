"use client";

import { useEffect, useState } from "react";
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@csa/ui";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  ADMIN_CLIENT_QUERY,
  ADMIN_UPDATE_CLIENT,
  ADMIN_CREATE_CLIENT_USER,
  ADMIN_UPDATE_CLIENT_USER,
  ADMIN_REMOVE_USER_FROM_CLIENT
} from "@/features/superadmin/api/queries";
import { CreateProjectModal } from "@/features/projects/CreateProjectModal";
import { ProjectConfigureModal } from "@/features/projects/ProjectConfigureModal";
import { notify } from "@/features/notifications/notification-store";

interface ProjectRow {
  id: string;
  projectKey: string;
  displayName?: string | null;
  platform?: string | null;
  standaloneB2bEnabled?: boolean;
  standaloneB2cEnabled?: boolean;
  ticketingProvider?: string | null;
  isConfigured?: boolean;
  status?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

interface ClientUserRow {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  active: boolean;
  clientProjects: Array<{
    projectKey: string;
    role: string;
  }>;
}

export function OrgSettingsPortalView() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"organization" | "projects" | "users">("organization");

  const organizationId = user?.activeClientId || user?.organization?.id;
  const isOrgAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Tab 1: Organization State
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [uiTheme, setUiTheme] = useState("csa-custom");
  const [orgSuccessMsg, setOrgSuccessMsg] = useState<string | null>(null);
  const [orgErrorMsg, setOrgErrorMsg] = useState<string | null>(null);

  // Tab 2: Projects Modals State
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [configuringProject, setConfiguringProject] = useState<ProjectRow | null>(null);

  // Tab 3: Users Modals State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createSelectedProjects, setCreateSelectedProjects] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [editingUser, setEditingUser] = useState<ClientUserRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editSelectedProjects, setEditSelectedProjects] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [removingUser, setRemovingUser] = useState<ClientUserRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemovingUser, setIsRemovingUser] = useState(false);

  // Data Query
  const { data, loading: queryLoading, error: queryError, refetch } = useQuery(ADMIN_CLIENT_QUERY, {
    variables: { id: organizationId },
    skip: !organizationId || !isOrgAdmin,
    fetchPolicy: "cache-first"
  });

  // Mutations
  const [updateClient, { loading: savingOrg }] = useMutation(ADMIN_UPDATE_CLIENT);
  const [createClientUser] = useMutation(ADMIN_CREATE_CLIENT_USER);
  const [updateClientUser] = useMutation(ADMIN_UPDATE_CLIENT_USER);
  const [removeUserFromClient] = useMutation(ADMIN_REMOVE_USER_FROM_CLIENT);

  const client = data?.adminClient;
  const projects: ProjectRow[] = data?.adminProjectsByClient ?? [];
  const uniqueProjects = projects.filter(
    (p: ProjectRow, index: number, self: ProjectRow[]) =>
      Boolean(p.projectKey) &&
      index ===
        self.findIndex(
          (t: ProjectRow) =>
            t.projectKey &&
            t.projectKey.toLowerCase() === p.projectKey?.toLowerCase()
        )
  );
  const users: ClientUserRow[] = data?.adminUsersByClient ?? [];

  useEffect(() => {
    if (client) {
      setName(client.name || "");
      setContactEmail(client.contactEmail || "");
      setUiTheme(client.uiTheme || "csa-custom");
    }
  }, [client]);

  // Loading and authorization guard states
  if (userLoading || (queryLoading && !data)) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isOrgAdmin) {
    return (
      <div className="mx-auto max-w-4xl py-12 px-4">
        <EmptyState
          icon="lock"
          title="Access Restricted"
          description="Organization Settings is exclusively available to Organization Administrators."
          action={
            <Button variant="primary" size="sm" onClick={() => router.push("/dashboard")}>
              Return to Studio Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  if (!organizationId || queryError || (!queryLoading && !client)) {
    return (
      <div className="mx-auto max-w-4xl py-12 px-4">
        <EmptyState
          icon="alert-triangle"
          title="Unable to load organization"
          description={queryError?.message || "Organization tenant could not be found or loaded."}
          action={
            <Button variant="secondary" size="sm" onClick={() => router.push("/dashboard")}>
              Return to Studio
            </Button>
          }
        />
      </div>
    );
  }

  // --- Tab 1 Handlers ---
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccessMsg(null);
    setOrgErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setOrgErrorMsg("Organization name is required.");
      return;
    }

    try {
      await updateClient({
        variables: {
          id: organizationId,
          name: trimmedName,
          contactEmail: contactEmail.trim() || undefined,
          uiTheme
        }
      });
      setOrgSuccessMsg("Organization details updated successfully.");
      notify({
        variant: "success",
        title: "Organization updated",
        description: "Organization details updated successfully."
      });
      await refetch();
      setTimeout(() => setOrgSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOrgErrorMsg(msg);
      notify({
        variant: "error",
        title: "Update failed",
        description: msg
      });
    }
  };

  // --- Tab 3 User Management Handlers ---
  const handleOpenCreateUser = () => {
    setCreateFirstName("");
    setCreateLastName("");
    setCreateEmail("");
    setCreatePassword("");
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
      setCreateError("Select at least one project for this member.");
      return;
    }

    setIsCreatingUser(true);
    try {
      await createClientUser({
        variables: {
          clientId: organizationId,
          grantedBy: user?.email || "admin",
          input: {
            email: emailClean,
            password: createPassword,
            firstName: createFirstName.trim() || undefined,
            lastName: createLastName.trim() || undefined,
            role: "agent",
            projects: createSelectedProjects.map((pk) => ({ projectKey: pk, role: "agent" }))
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

  const handleOpenEditUser = (targetUser: ClientUserRow) => {
    setEditingUser(targetUser);
    setEditFirstName(targetUser.firstName || "");
    setEditLastName(targetUser.lastName || "");
    setEditPassword("");
    setEditActive(targetUser.active !== false);
    setEditSelectedProjects(
      targetUser.clientProjects ? targetUser.clientProjects.map((cp) => cp.projectKey) : []
    );
    setEditError(null);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingUser) return;
    if (!editingUser) return;
    setEditError(null);

    if (editPassword && editPassword.length < 8) {
      setEditError("Password must be at least 8 characters long if provided.");
      return;
    }

    const isTargetAdmin = editingUser.role === "admin";
    if (!isTargetAdmin && uniqueProjects.length > 0 && editSelectedProjects.length === 0) {
      setEditError("Select at least one project for this member.");
      return;
    }

    setIsSavingUser(true);
    try {
      await updateClientUser({
        variables: {
          clientId: organizationId,
          grantedBy: user?.email || "admin",
          input: {
            email: editingUser.email,
            firstName: editFirstName.trim() || undefined,
            lastName: editLastName.trim() || undefined,
            password: editPassword.trim() || undefined,
            role: editingUser.role,
            active: isTargetAdmin ? true : editActive,
            projects: isTargetAdmin
              ? undefined
              : editSelectedProjects.map((pk) => ({ projectKey: pk, role: "agent" }))
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

    if (removingUser.role === "admin") {
      setRemoveError("The Organization Admin account cannot be removed.");
      return;
    }

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
        description: `User "${removedEmail}" removed from organization.`
      });
      await refetch();
    } catch (err: unknown) {
      setRemoveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRemovingUser(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-m-primary">
              Organization Admin
            </p>
            <Badge variant="primary" appearance="subtle" size="sm">
              Tenant Scoped
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-m-text">
            {client?.name || "Organization Settings"}
          </h1>
          <p className="mt-0.5 text-xs text-m-text-muted">
            Manage your organization profile, commerce projects, users, and project access permissions.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-m-border">
        <button
          onClick={() => setActiveTab("organization")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "organization"
              ? "border-m-primary text-m-primary"
              : "border-transparent text-m-text-muted hover:border-m-border hover:text-m-text"
          }`}
        >
          <Icon name="building-2" size="xs" />
          <span>Organization</span>
        </button>

        <button
          onClick={() => setActiveTab("projects")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "projects"
              ? "border-m-primary text-m-primary"
              : "border-transparent text-m-text-muted hover:border-m-border hover:text-m-text"
          }`}
        >
          <Icon name="briefcase" size="xs" />
          <span>Projects</span>
          <span className="rounded-full bg-m-neutral-100 px-1.5 py-0.2 text-[10px] font-mono">
            {projects.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "users"
              ? "border-m-primary text-m-primary"
              : "border-transparent text-m-text-muted hover:border-m-border hover:text-m-text"
          }`}
        >
          <Icon name="users" size="xs" />
          <span>Users & Access</span>
          <span className="rounded-full bg-m-neutral-100 px-1.5 py-0.2 text-[10px] font-mono">
            {users.length}
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: Organization Details                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "organization" && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-m-border bg-m-surface p-4">
              <p className="text-xs font-medium text-m-text-muted">Total Projects</p>
              <p className="mt-1 text-2xl font-bold text-m-text">{projects.length}</p>
            </div>
            <div className="rounded-xl border border-m-border bg-m-surface p-4">
              <p className="text-xs font-medium text-m-text-muted">Users & Members</p>
              <p className="mt-1 text-2xl font-bold text-m-text">{users.length}</p>
            </div>
            <div className="rounded-xl border border-m-border bg-m-surface p-4">
              <p className="text-xs font-medium text-m-text-muted">Account Status</p>
              <div className="mt-1">
                <Badge variant={client?.status === "active" ? "success" : "neutral"} size="sm">
                  {client?.status || "active"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {orgSuccessMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
              <Icon name="check" size="sm" />
              <span>{orgSuccessMsg}</span>
            </div>
          )}
          {orgErrorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
              <Icon name="alert-triangle" size="sm" />
              <span>{orgErrorMsg}</span>
            </div>
          )}

          {/* Form Card */}
          <Card className="border border-m-border bg-m-surface p-6 shadow-m-card">
            <form onSubmit={handleSaveOrganization} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                  Organization Name
                </label>
                <Input
                  className="mt-1.5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                  Contact Email
                </label>
                <Input
                  type="email"
                  className="mt-1.5"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="admin@acmecorp.com"
                />
                <p className="mt-1 text-xs text-m-text-muted">
                  Primary administrative contact for system notifications and alerts.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                  Application Design Theme
                </label>
                <Select
                  className="mt-1.5"
                  value={uiTheme}
                  onChange={(e) => setUiTheme(e.target.value)}
                >
                  <option value="csa-custom">CSA Modern (Meridian)</option>
                  <option value="mantine">Clean Corporate (Mantine Inspired)</option>
                  <option value="mui">Enterprise Standard (Material Inspired)</option>
                </Select>
                <p className="mt-1 text-xs text-m-text-muted">
                  Applies the visual theme and token styling across Studio for all organization members.
                </p>
              </div>

              <div className="flex items-center justify-end border-t border-m-border pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingOrg}
                  className="flex items-center gap-2"
                >
                  {savingOrg && <Icon name="loader" className="animate-spin" size="xs" />}
                  <span>Save Organization Details</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: Projects                                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-m-text">Commerce Projects</h2>
              <p className="text-xs text-m-text-muted">
                Manage project connections and commerce platform credentials.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateProjectOpen(true)}
              leftIcon={<Icon name="plus" size="xs" />}
            >
              Create Project
            </Button>
          </div>

          <Card className="overflow-hidden border border-m-border bg-m-surface shadow-m-card">
            {projects.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon="briefcase"
                  title="No projects configured yet"
                  description="Your organization has zero projects. Create a new project to connect your commerce platform."
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
              <Table className="rounded-none border-0 shadow-none">
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
                  {projects.map((p: ProjectRow) => {
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
                            className="font-mono text-[10px] uppercase"
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfiguringProject(p)}
                            leftIcon={<Icon name="edit" size="xs" />}
                          >
                            Configure
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: Users & Access                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-m-text">Team & Users</h2>
              <p className="text-xs text-m-text-muted">
                Manage organization members and assign project access permissions.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateUser}
              leftIcon={<Icon name="plus" size="xs" />}
            >
              Add User
            </Button>
          </div>

          <Card className="overflow-hidden border border-m-border bg-m-surface shadow-m-card">
            {users.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon="users"
                  title="No users provisioned"
                  description="No members exist in this organization. Add a user to grant project access."
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
              <Table className="rounded-none border-0 shadow-none">
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
                  {users.map((u) => {
                    const isUserAdmin = u.role === "admin";
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-bold text-m-text">
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-m-text">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isUserAdmin ? "primary" : "neutral"}
                            appearance="subtle"
                            size="sm"
                          >
                            {isUserAdmin ? "Organization Admin" : "Member / Agent"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isUserAdmin ? (
                            <span className="text-xs italic text-m-text-muted">
                              All Projects (Org Level)
                            </span>
                          ) : u.clientProjects && u.clientProjects.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.clientProjects.map((cp) => (
                                <span
                                  key={cp.projectKey}
                                  className="rounded border border-m-border bg-m-neutral-100 px-1.5 py-0.5 font-mono text-[10px]"
                                >
                                  {cp.projectKey}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs italic text-m-text-muted">
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
                            {!isUserAdmin && (
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
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Project Creation & Configuration Modals (Reused from Superadmin)   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        clientId={organizationId}
        onSuccess={() => void refetch()}
      />

      {configuringProject && (
        <ProjectConfigureModal
          isOpen={Boolean(configuringProject)}
          project={configuringProject}
          onClose={() => setConfiguringProject(null)}
          onSuccess={() => {
            setConfiguringProject(null);
            void refetch();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* User Creation Modal (Add User)                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateUserOpen}
        onClose={() => !isCreatingUser && setIsCreateUserOpen(false)}
        size="md"
      >
        <ModalHeader title="Add New User" />
        <form onSubmit={handleCreateUserSubmit}>
          <ModalBody className="space-y-4">
            {createError && (
              <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                  First Name
                </label>
                <Input
                  className="mt-1"
                  value={createFirstName}
                  onChange={(e) => setCreateFirstName(e.target.value)}
                  placeholder="Jane"
                  disabled={isCreatingUser}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                  Last Name
                </label>
                <Input
                  className="mt-1"
                  value={createLastName}
                  onChange={(e) => setCreateLastName(e.target.value)}
                  placeholder="Doe"
                  disabled={isCreatingUser}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                className="mt-1"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="jane.doe@organization.com"
                required
                disabled={isCreatingUser}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                Initial Password <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                className="mt-1"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                disabled={isCreatingUser}
              />
              <p className="mt-1 text-[11px] text-m-text-muted">
                Temporary password for the user&apos;s initial sign-in.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                User Role
              </label>
              <div className="mt-1 flex items-center gap-2 rounded border border-m-border bg-m-neutral-50 p-2.5">
                <Icon name="user" size="xs" className="text-m-text-muted" />
                <span className="text-xs font-semibold text-m-text">Member / Agent</span>
                <span className="text-[11px] text-m-text-muted">
                  (Single Organization Admin restriction active)
                </span>
              </div>
            </div>

            {/* Project Access Assignment */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                Project Access Assignment <span className="text-red-500">*</span>
              </label>
              <p className="mb-2 text-[11px] text-m-text-muted">
                Select which commerce projects this user is permitted to access.
              </p>
              {uniqueProjects.length === 0 ? (
                <div className="rounded border border-dashed border-m-border p-3 text-center text-xs text-m-text-muted">
                  No projects configured yet. The user will have no initial project access until a project is created.
                </div>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-m-border bg-m-surface p-3">
                  {uniqueProjects.map((p: ProjectRow) => {
                    const isSelected = createSelectedProjects.includes(p.projectKey);
                    const inputId = `org-create-proj-${p.projectKey}`;
                    return (
                      <div
                        key={p.projectKey}
                        className="flex items-center gap-3 rounded p-1.5 transition-colors hover:bg-m-neutral-50"
                      >
                        <input
                          type="checkbox"
                          id={inputId}
                          value={p.projectKey}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateSelectedProjects((prev) => [...prev, p.projectKey]);
                            } else {
                              setCreateSelectedProjects((prev) =>
                                prev.filter((k) => k !== p.projectKey)
                              );
                            }
                          }}
                          className="h-4 w-4 rounded border-m-border text-m-primary focus:ring-m-primary"
                          disabled={isCreatingUser}
                        />
                        <label
                          htmlFor={inputId}
                          className="flex flex-1 cursor-pointer items-center justify-between text-xs"
                        >
                          <span className="font-medium text-m-text">
                            {p.displayName || p.projectKey}
                          </span>
                          <span className="font-mono text-[10px] text-m-text-muted">
                            {p.projectKey}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
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
              Add User
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* User Editing Modal (Edit User)                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(editingUser)}
        onClose={() => !isSavingUser && setEditingUser(null)}
        size="md"
      >
        <ModalHeader title={`Edit User: ${editingUser?.email}`} />
        <form onSubmit={handleEditUserSubmit}>
          <ModalBody className="space-y-4">
            {editError && (
              <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                  First Name
                </label>
                <Input
                  className="mt-1"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  disabled={isSavingUser}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                  Last Name
                </label>
                <Input
                  className="mt-1"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  disabled={isSavingUser}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                Reset Password
              </label>
              <Input
                type="password"
                className="mt-1"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                disabled={isSavingUser}
              />
              <p className="mt-1 text-[11px] text-m-text-muted">
                Only fill this in if you want to override the user&apos;s password.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                Role
              </label>
              <div className="mt-1 flex items-center gap-2 rounded border border-m-border bg-m-neutral-50 p-2.5">
                <Icon
                  name={editingUser?.role === "admin" ? "shield-check" : "user"}
                  size="xs"
                  className="text-m-text-muted"
                />
                <span className="text-xs font-semibold text-m-text">
                  {editingUser?.role === "admin"
                    ? "Organization Admin (Primary)"
                    : "Member / Agent"}
                </span>
                <span className="text-[11px] text-m-text-muted">
                  {editingUser?.role === "admin"
                    ? "(Organization-level administrator)"
                    : "(Project-scoped access)"}
                </span>
              </div>
            </div>

            {/* Account Status Toggle (Non-Admin only) */}
            {editingUser?.role !== "admin" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="org-edit-user-active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-m-border text-m-primary focus:ring-m-primary"
                  disabled={isSavingUser}
                />
                <label htmlFor="org-edit-user-active" className="cursor-pointer text-xs font-medium text-m-text">
                  Account Active (User can authenticate and work tickets)
                </label>
              </div>
            )}

            {/* Project Access Assignment */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-m-text-muted">
                Project Access Assignment
              </label>
              {editingUser?.role === "admin" ? (
                <div className="mt-1.5 flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                  <Icon name="check-circle" size="xs" />
                  <span>
                    Organization Admins automatically have access to all projects in this organization.
                  </span>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-[11px] text-m-text-muted">
                    Assign or remove access to specific commerce projects independently.
                  </p>
                  {uniqueProjects.length === 0 ? (
                    <div className="rounded border border-dashed border-m-border p-3 text-center text-xs text-m-text-muted">
                      No projects configured yet.
                    </div>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-m-border bg-m-surface p-3">
                      {uniqueProjects.map((p: ProjectRow) => {
                        const isSelected = editSelectedProjects.includes(p.projectKey);
                        const inputId = `org-edit-proj-${p.projectKey}`;
                        return (
                          <div
                            key={p.projectKey}
                            className="flex items-center gap-3 rounded p-1.5 transition-colors hover:bg-m-neutral-50"
                          >
                            <input
                              type="checkbox"
                              id={inputId}
                              value={p.projectKey}
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditSelectedProjects((prev) => [...prev, p.projectKey]);
                                } else {
                                  setEditSelectedProjects((prev) =>
                                    prev.filter((k) => k !== p.projectKey)
                                  );
                                }
                              }}
                              className="h-4 w-4 rounded border-m-border text-m-primary focus:ring-m-primary"
                              disabled={isSavingUser}
                            />
                            <label
                              htmlFor={inputId}
                              className="flex flex-1 cursor-pointer items-center justify-between text-xs"
                            >
                              <span className="font-medium text-m-text">
                                {p.displayName || p.projectKey}
                              </span>
                              <span className="font-mono text-[10px] text-m-text-muted">
                                {p.projectKey}
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* User Removal Confirmation Modal                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(removingUser)}
        onClose={() => !isRemovingUser && setRemovingUser(null)}
        size="sm"
      >
        <ModalHeader title="Remove User" />
        <ModalBody className="space-y-3">
          {removeError && (
            <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600">
              {removeError}
            </div>
          )}
          <p className="text-xs text-m-text">
            Are you sure you want to remove user{" "}
            <span className="font-bold text-m-text">{removingUser?.email}</span> from this organization?
          </p>
          <p className="text-[11px] text-m-text-muted">
            The user will lose access to all projects in this organization. Their account record will be deactivated.
          </p>
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
    </div>
  );
}
