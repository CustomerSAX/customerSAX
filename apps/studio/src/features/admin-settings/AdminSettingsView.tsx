"use client";

import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import type { MutationFunction } from "@apollo/client";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button, Checkbox, Icon, Input, Select, TextArea } from "@csa/ui";

type Section = "users" | "roles" | "email" | "ai";
type Permission = { module: string; view: boolean; create: boolean; update: boolean; delete: boolean };
type PermissionAction = keyof Omit<Permission, "module">;
type Role = { id: string; key: string; label: string; description: string; system: boolean; permissions: Permission[] };
type ClientProjectMembership = { projectKey: string; role: string };
type AdminUserRow = { id: string; email: string; firstName?: string | null; lastName?: string | null; active: boolean; clientProjects: ClientProjectMembership[] };
type AdminClient = { id: string; name: string; contactEmail?: string | null };
type AdminProject = { id: string; projectKey: string; displayName?: string | null; smtpProfileId?: string | null; standaloneB2cEnabled?: boolean | null; standaloneB2bEnabled?: boolean | null };
type AdminSmtpProfile = { id: string; name: string; smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser?: string | null; smtpPasswordMasked?: string | null; emailFrom: string; isDefault: boolean };
type AdminAiSettings = { enabled: boolean; provider: string; displayName?: string | null; model?: string | null; baseUrl?: string | null; apiKeySet?: boolean; updatedBy?: string | null; updatedAt?: string | null };
type WorkspaceAdminData = {
  adminClient: AdminClient;
  adminProjectsByClient: AdminProject[];
  adminUsersByClient: AdminUserRow[];
  adminSmtpProfilesByClient: AdminSmtpProfile[];
  adminRoles: Role[];
  adminAiSettings: AdminAiSettings;
};
type CreateRoleResult = { adminCreateRole: { id: string } };
type CreateRoleVariables = { clientId: string; projectKey: string; input: { key: string; label: string; description: string; permissions: Permission[] } };
type SmtpForm = { name: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPassword: string; emailFrom: string; smtpSecure: boolean; isDefault: boolean };
type AiSettingsForm = AdminAiSettings & { apiKey: string };
type AiSettingsField = "displayName" | "model" | "baseUrl" | "apiKey";

const WORKSPACE_ADMIN = gql`
  query WorkspaceAdmin($clientId: ID!, $projectKey: String!) {
    adminClient(id: $clientId) { id name contactEmail }
    adminProjectsByClient(clientId: $clientId) { id projectKey displayName smtpProfileId standaloneB2cEnabled standaloneB2bEnabled }
    adminUsersByClient(clientId: $clientId) { id email firstName lastName active clientProjects { projectKey role } }
    adminSmtpProfilesByClient(clientId: $clientId) { id name smtpHost smtpPort smtpSecure smtpUser smtpPasswordMasked emailFrom isDefault }
    adminRoles(clientId: $clientId, projectKey: $projectKey) { id key label description system permissions { module view create update delete } }
    adminAiSettings(clientId: $clientId) { enabled provider displayName model baseUrl apiKeySet updatedBy updatedAt }
  }
`;

const UPDATE_USER = gql`mutation UpdateWorkspaceUser($clientId: ID!, $input: AdminUpdateClientUserInput!, $grantedBy: String!) { adminUpdateClientUser(clientId: $clientId, input: $input, grantedBy: $grantedBy) { email } }`;
const CREATE_USER = gql`mutation CreateWorkspaceUser($clientId: ID!, $input: AdminCreateUserInput!, $grantedBy: String!) { adminCreateClientUser(clientId: $clientId, input: $input, grantedBy: $grantedBy) { id email firstName lastName active clientProjects { projectKey role } } }`;
const UPDATE_CONTACT = gql`mutation UpdateContact($clientId: ID!, $contactEmail: String!) { adminUpdateClientContact(clientId: $clientId, contactEmail: $contactEmail) { id contactEmail } }`;
const CREATE_ROLE = gql`mutation CreateRole($clientId: ID!, $projectKey: String!, $input: AdminRoleInput!) { adminCreateRole(clientId: $clientId, projectKey: $projectKey, input: $input) { id } }`;
const UPDATE_ROLE = gql`mutation UpdateRole($id: ID!, $clientId: ID!, $projectKey: String!, $input: AdminRoleUpdateInput!) { adminUpdateRole(id: $id, clientId: $clientId, projectKey: $projectKey, input: $input) { id } }`;
const DELETE_ROLE = gql`mutation DeleteRole($id: ID!, $clientId: ID!, $projectKey: String!) { adminDeleteRole(id: $id, clientId: $clientId, projectKey: $projectKey) }`;
const CREATE_SMTP = gql`mutation CreateSmtp($clientId: ID!, $input: AdminSmtpProfileInput!) { adminCreateSmtpProfile(clientId: $clientId, input: $input) { id } }`;
const DELETE_SMTP = gql`mutation DeleteSmtp($id: ID!, $clientId: ID!) { adminDeleteSmtpProfile(id: $id, clientId: $clientId) }`;
const TEST_SMTP = gql`mutation TestSmtp($id: ID!, $clientId: ID!, $to: String) { adminTestSmtpProfile(id: $id, clientId: $clientId, to: $to) { ok message } }`;
const ROUTE_SMTP = gql`mutation RouteSmtp($clientId: ID!, $projectKey: String!, $smtpProfileId: String) { adminSetProjectSmtp(clientId: $clientId, projectKey: $projectKey, smtpProfileId: $smtpProfileId) }`;
const UPDATE_AI = gql`mutation UpdateAi($clientId: ID!, $input: AdminAiSettingsInput!) { adminUpdateAiSettings(clientId: $clientId, input: $input) { enabled provider displayName model baseUrl apiKeySet } }`;

const modules = ["dashboard", "tickets", "customers", "orders", "carts", "products", "reports", "knowledgebase", "assistant", "users", "roles", "email", "audit"];
const blankPermissions = () => modules.map((module) => ({ module, view: true, create: false, update: false, delete: false }));
const sections: Array<{ id: Section; label: string }> = [
  { id: "users", label: "User Management" },
  { id: "roles", label: "Role Management" },
  { id: "email", label: "Email Settings" },
  { id: "ai", label: "AI Agent" },
];

export function AdminSettingsView({ section }: { section: Section }) {
  const [activeSection, setActiveSection] = useState<Section>(section);
  const { user, loading: userLoading } = useCurrentUser();
  const clientId = user?.activeClientId ?? "";
  const projectKey = user?.activeProjectKey ?? "";
  const allowed = user?.role === "admin" || user?.role === "superadmin";
  const { data, loading, error, refetch } = useQuery<WorkspaceAdminData>(WORKSPACE_ADMIN, { variables: { clientId, projectKey }, skip: !clientId || !projectKey || !allowed, fetchPolicy: "cache-and-network" });

  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  if (userLoading) return <AppShell><State text="Checking administrator access…" /></AppShell>;
  if (!allowed) return <AppShell><State text="Administrator access is required." /></AppShell>;
  if (!clientId || !projectKey) return <AppShell><State text="Select a project before opening Admin Settings." /></AppShell>;

  return <AppShell><div className="space-y-6 p-6">
    <div><p className="text-xs font-bold uppercase tracking-widest text-m-primary">Admin Settings</p><h1 className="text-2xl font-bold text-m-text">{data?.adminClient?.name ?? "Organisation"}</h1><p className="mt-1 text-sm text-m-text-muted">Settings apply to the active project. Switch projects in the header to manage another workspace.</p></div>
    <nav className="flex flex-wrap gap-2 rounded-xl border border-m-border bg-m-surface p-2" aria-label="Admin settings sections">
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-current={activeSection === id ? "page" : undefined}
          onClick={() => setActiveSection(id)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeSection === id ? "bg-m-primary text-white" : "text-m-text-muted hover:bg-m-surface-bg"}`}
        >
          {label}
        </button>
      ))}
    </nav>
    {loading ? <State text="Loading settings…" /> : error ? <State text={error.message} /> : !data ? <State text="Settings are unavailable." /> : activeSection === "users" ? <Users data={data} clientId={clientId} projectKey={projectKey} actor={user?.email ?? ""} refetch={refetch} /> : activeSection === "roles" ? <Roles roles={data.adminRoles} clientId={clientId} projectKey={projectKey} refetch={refetch} /> : activeSection === "email" ? <EmailSettings data={data} clientId={clientId} refetch={refetch} /> : <AiSettings settings={data.adminAiSettings} clientId={clientId} refetch={refetch} />}
  </div></AppShell>;
}

function Users({ data, clientId, projectKey, actor, refetch }: { data: WorkspaceAdminData; clientId: string; projectKey: string; actor: string; refetch: () => Promise<unknown> }) {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [updateUser] = useMutation(UPDATE_USER);
  const roles: Role[] = data.adminRoles;
  const users = useMemo(() => data.adminUsersByClient.filter((u) => `${u.email} ${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data.adminUsersByClient, search]);
  async function changeRole(user: AdminUserRow, role: string) { const projects = user.clientProjects.map((p) => p.projectKey === projectKey ? { ...p, role } : { projectKey: p.projectKey, role: p.role }); await updateUser({ variables: { clientId, grantedBy: actor, input: { email: user.email, projects } } }); await refetch(); }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">User Management</h2>
          <p className="text-sm text-m-text-muted">Manage roles for <strong>{projectKey}</strong>.</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)}>
          Add User
        </Button>
      </div>
      <input aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or name…" className="w-full rounded-lg border border-m-border bg-m-surface px-3 py-2"/>
      <div className="overflow-auto rounded-xl border border-m-border bg-m-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-m-border text-left">
              <th className="p-3">Email</th>
              <th>Name</th>
              <th>Role ({projectKey})</th>
              <th>Change Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const membership = u.clientProjects.find((p) => p.projectKey === projectKey);
              if (!membership) return null;
              return (
                <tr key={u.id} className="border-b border-m-border">
                  <td className="p-3 font-medium">{u.email}</td>
                  <td>{[u.firstName, u.lastName].filter(Boolean).join(" ") || "--"}</td>
                  <td>{membership.role}</td>
                  <td>
                    <select aria-label={`Change role for ${u.email}`} value={membership.role} onChange={(e) => void changeRole(u, e.target.value)} className="rounded border border-m-border bg-m-surface px-2 py-1">
                      {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AddUserModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        clientId={clientId}
        projectKey={projectKey}
        actor={actor}
        roles={roles}
        projects={data.adminProjectsByClient}
        onSaved={async () => {
          setIsAddOpen(false);
          await refetch();
        }}
      />
    </section>
  );
}

function defaultRoleKey(roles: Role[]) {
  return roles.find((role) => role.key === "customer_service_agent")?.key ?? roles.find((role) => role.key === "member")?.key ?? roles[0]?.key ?? "admin";
}

function permissionInput(permission: Permission): Permission {
  return {
    module: permission.module,
    view: permission.view,
    create: permission.create,
    update: permission.update,
    delete: permission.delete,
  };
}

function permissionInputs(permissions: Permission[]): Permission[] {
  return permissions.map(permissionInput);
}

function slugifyRoleKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function AddUserModal({ isOpen, onClose, clientId, projectKey, actor, roles, projects, onSaved }: { isOpen: boolean; onClose: () => void; clientId: string; projectKey: string; actor: string; roles: Role[]; projects: AdminProject[]; onSaved: () => Promise<void> }) {
  const [createUser] = useMutation(CREATE_USER);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRoleKey(roles));
  const [selectedProjectKeys, setSelectedProjectKeys] = useState<string[]>([projectKey]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setRole(defaultRoleKey(roles));
    setSelectedProjectKeys(projects.some((project) => project.projectKey === projectKey) ? [projectKey] : projects[0]?.projectKey ? [projects[0].projectKey] : []);
    setShowPassword(false);
    setError(null);
  }, [isOpen, projectKey, projects, roles]);

  function toggleProject(nextProjectKey: string) {
    setSelectedProjectKeys((current) => current.includes(nextProjectKey) ? current.filter((key) => key !== nextProjectKey) : [...current, nextProjectKey]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!actor) {
      setError("Still loading your session. Try again in a moment.");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 8) {
      setError("Email and an 8 character password are required.");
      return;
    }
    if (selectedProjectKeys.length === 0) {
      setError("Select at least one project.");
      return;
    }

    setIsSaving(true);
    try {
      await createUser({
        variables: {
          clientId,
          grantedBy: actor,
          input: {
            email: trimmedEmail,
            password,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            projects: selectedProjectKeys.map((selectedProjectKey) => ({ projectKey: selectedProjectKey, role })),
          },
        },
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create user");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-m-neutral-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
      <div className="w-full max-w-md overflow-y-auto rounded-xl bg-m-surface p-7 shadow-m-modal" style={{ maxHeight: "90vh" }}>
        <h2 id="add-user-title" className="text-lg font-bold text-m-primary">Add User</h2>
        <p className="mt-1 text-sm text-m-text-muted">Creates a workspace user with access to the selected projects.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-m-text">First Name<Input className="mt-1" value={firstName} onChange={(event)=>setFirstName(event.target.value)} /></label>
            <label className="block text-sm font-semibold text-m-text">Last Name<Input className="mt-1" value={lastName} onChange={(event)=>setLastName(event.target.value)} /></label>
          </div>
          <label className="block text-sm font-semibold text-m-text">Email <span className="text-m-error">*</span><Input className="mt-1" type="email" value={email} onChange={(event)=>setEmail(event.target.value)} required /></label>
          <label className="block text-sm font-semibold text-m-text">Password <span className="text-m-error">*</span><Input className="mt-1 pr-16" type={showPassword ? "text" : "password"} value={password} onChange={(event)=>setPassword(event.target.value)} required minLength={8} rightElement={<button type="button" className="text-xs font-semibold text-m-text-muted hover:text-m-text" onClick={()=>setShowPassword((value)=>!value)}>{showPassword ? "Hide" : "Show"}</button>} /></label>
          <label className="block text-sm font-semibold text-m-text">Role <span className="text-m-error">*</span><Select className="mt-1" value={role} onChange={(event)=>setRole(event.target.value)}>{roles.length === 0 && <option value="admin">Admin</option>}{roles.map((item)=><option key={item.key} value={item.key}>{item.label}</option>)}</Select></label>

          <div className="rounded-lg border border-m-border bg-m-surface-2 p-3">
            <div className="text-xs font-bold uppercase text-m-text-muted">Allowed projects <span className="text-m-error">*</span></div>
            <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-sm text-m-text-muted">No projects are available for this client.</p>
              ) : (
                projects.map((project) => {
                  const checked = selectedProjectKeys.includes(project.projectKey);
                  const shellLabel = project.standaloneB2bEnabled ? "B2B" : project.standaloneB2cEnabled ? "B2C" : null;
                  return (
                    <label key={project.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm text-m-text hover:bg-m-surface">
                      <Checkbox checked={checked} onChange={() => toggleProject(project.projectKey)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="truncate">{project.displayName || project.projectKey}</span>
                          {shellLabel && <span className="shrink-0 rounded bg-m-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-m-primary">{shellLabel}</span>}
                        </span>
                        {project.displayName && <span className="block text-xs text-m-text-muted">{project.projectKey}</span>}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {error && <p className="text-sm text-m-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSaving} disabled={!email.trim() || password.length < 8 || !role || selectedProjectKeys.length === 0}>Create User</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Roles({ roles, clientId, projectKey, refetch }: { roles: Role[]; clientId: string; projectKey: string; refetch: () => Promise<unknown> }) {
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0];
  const selectedPermissions = permissionInputs(selected?.permissions ?? []);
  const [draftPermissions, setDraftPermissions] = useState<Permission[]>(selectedPermissions);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apolloClient = useApolloClient();
  const [createRole] = useMutation<CreateRoleResult, CreateRoleVariables>(CREATE_ROLE);
  const [updateRole] = useMutation(UPDATE_ROLE);
  const [deleteRole] = useMutation(DELETE_ROLE);
  const actions: PermissionAction[] = ["view", "create", "update", "delete"];
  const hasChanges = Boolean(selected) && JSON.stringify(draftPermissions) !== JSON.stringify(selectedPermissions);

  useEffect(() => {
    if (!selectedId && roles[0]?.id) setSelectedId(roles[0].id);
    if (selectedId && !roles.some((role) => role.id === selectedId)) setSelectedId(roles[0]?.id ?? "");
  }, [roles, selectedId]);

  useEffect(() => {
    setDraftPermissions(permissionInputs(selected?.permissions ?? []));
    setError(null);
  }, [selected?.id, selected?.permissions]);

  function toggle(module: string, action: PermissionAction) {
    setDraftPermissions((current) => current.map((permission) => permission.module === module ? { ...permission, [action]: !permission[action] } : permission));
  }

  async function save() {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateRole({ variables: { id: selected.id, clientId, projectKey, input: { permissions: permissionInputs(draftPermissions) } } });
      await refetch();
      await apolloClient.refetchQueries({ include: ["ShellRoles"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save role permissions");
      setDraftPermissions(selectedPermissions);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelectedRole() {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteRole({ variables: { id: selected.id, clientId, projectKey } });
      setSelectedId("");
      await refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete role");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex justify-between">
        <div>
          <h2 className="text-xl font-bold">Role Management</h2>
          <p className="text-sm text-m-text-muted">Page and action permissions for {projectKey}.</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size="xs" />} onClick={() => setIsAddOpen(true)}>
          Add Role
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedId(role.id)}
              className={`w-full rounded-xl border p-4 text-left ${selected?.id === role.id ? "border-m-primary bg-m-primary-50" : "border-m-border bg-m-surface"}`}
            >
              <strong>{role.label}</strong>
              <span className="ml-2 text-xs text-m-text-muted">{role.system ? "System" : role.key}</span>
              <p className="mt-1 text-xs text-m-text-muted">{role.description}</p>
            </button>
          ))}
        </div>

        {selected && (
          <div className="overflow-auto rounded-xl border border-m-border bg-m-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">{selected.label} ACL</h3>
                {hasChanges && <p className="text-xs text-m-text-muted">Unsaved permission changes</p>}
              </div>
              <div className="flex gap-2">
                {hasChanges && (
                  <Button variant="secondary" size="sm" onClick={() => setDraftPermissions(selectedPermissions)} disabled={isSaving}>
                    Discard
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => void save()} disabled={!hasChanges} loading={isSaving}>
                  Save
                </Button>
                {!selected.system && (
                  <Button variant="danger" size="sm" onClick={() => void removeSelectedRole()} disabled={isSaving}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
            {error && <p className="mb-3 rounded-lg border border-m-error-border bg-m-error-light px-3 py-2 text-sm text-m-error">{error}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Module</th>
                  {actions.map((action) => <th key={action} className="p-2 capitalize">{action}</th>)}
                </tr>
              </thead>
              <tbody>
                {draftPermissions.map((permission) => (
                  <tr key={permission.module} className="border-t border-m-border">
                    <td className="py-2 capitalize">{permission.module}</td>
                    {actions.map((action) => (
                      <td key={action} className="text-center">
                        <input
                          aria-label={`${selected.label} ${permission.module} ${action}`}
                          type="checkbox"
                          checked={permission[action]}
                          onChange={() => toggle(permission.module, action)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AddRoleModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        createRole={createRole}
        clientId={clientId}
        projectKey={projectKey}
        existingKeys={roles.map((role) => role.key)}
        onSaved={async (roleId) => {
          setIsAddOpen(false);
          setSelectedId(roleId);
          await refetch();
        }}
      />
    </section>
  );
}

function AddRoleModal({ isOpen, onClose, createRole, clientId, projectKey, existingKeys, onSaved }: { isOpen: boolean; onClose: () => void; createRole: MutationFunction<CreateRoleResult, CreateRoleVariables>; clientId: string; projectKey: string; existingKeys: string[]; onSaved: (roleId: string) => Promise<void> }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedKey = slugifyRoleKey(key);
  const isValid = Boolean(normalizedKey && label.trim());

  useEffect(() => {
    if (!isOpen) return;
    setKey("");
    setLabel("");
    setDescription("");
    setError(null);
  }, [isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValid) {
      setError("Role name and display label are required.");
      return;
    }
    if (existingKeys.includes(normalizedKey)) {
      setError("A role with this slug already exists.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createRole({
        variables: {
          clientId,
          projectKey,
          input: {
            key: normalizedKey,
            label: label.trim(),
            description: description.trim() || "Custom workspace role",
            permissions: blankPermissions(),
          },
        },
      });
      await onSaved(result.data?.adminCreateRole?.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create role");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-m-neutral-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="add-role-title">
      <div className="w-full max-w-md overflow-y-auto rounded-xl bg-m-surface p-7 shadow-m-modal" style={{ maxHeight: "90vh" }}>
        <h2 id="add-role-title" className="text-lg font-bold text-m-primary">Add Custom Role</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-m-text">
            Role Name (slug) <span className="text-m-error">*</span>
            <Input className="mt-1" value={key} onChange={(event) => setKey(event.target.value)} placeholder="e.g. supervisor" required />
            <span className="mt-1 block text-xs font-normal text-m-text-muted">Lowercase letters, numbers, underscores only. Cannot be changed after creation.</span>
          </label>
          <label className="block text-sm font-semibold text-m-text">
            Display Label <span className="text-m-error">*</span>
            <Input className="mt-1" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Supervisor" required />
          </label>
          <label className="block text-sm font-semibold text-m-text">
            Description
            <TextArea className="mt-1" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What can this role do?" resize="vertical" />
          </label>
          {key && key !== normalizedKey && <p className="text-xs text-m-text-muted">Will be saved as <code>{normalizedKey}</code>.</p>}
          {error && <p className="text-sm text-m-error">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSaving} disabled={!isValid}>Create Role</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmailSettings({ data, clientId, refetch }: { data: WorkspaceAdminData; clientId: string; refetch: () => Promise<unknown> }) {
  const [contact,setContact]=useState(data.adminClient.contactEmail??""); const [showAdd,setShowAdd]=useState(false); const [form,setForm]=useState({name:"",smtpHost:"",smtpPort:587,smtpUser:"",smtpPassword:"",emailFrom:"",smtpSecure:false,isDefault:false}); const [status,setStatus]=useState(""); const [saveContact]=useMutation(UPDATE_CONTACT); const [createSmtp]=useMutation(CREATE_SMTP); const [deleteSmtp]=useMutation(DELETE_SMTP); const [testSmtp]=useMutation(TEST_SMTP); const [routeSmtp]=useMutation(ROUTE_SMTP);
  return <section className="space-y-6"><div><h2 className="text-xl font-bold">Email Settings</h2><p className="text-sm text-m-text-muted">Configure outbound email and project routing.</p></div><div className="rounded-xl border border-m-border bg-m-surface p-4"><label className="text-sm font-semibold">Organisation contact email</label><div className="mt-2 flex gap-2"><input value={contact} onChange={e=>setContact(e.target.value)} className="flex-1 rounded border border-m-border px-3 py-2"/><button onClick={async()=>{await saveContact({variables:{clientId,contactEmail:contact}});setStatus("Contact email saved")}} className="rounded bg-m-primary px-4 text-white">Save</button></div></div><div className="rounded-xl border border-m-border bg-m-surface p-4"><div className="flex justify-between"><h3 className="font-bold">SMTP profiles</h3><button onClick={()=>setShowAdd(!showAdd)} className="text-sm font-bold text-m-primary">+ Add profile</button></div>{showAdd&&<div className="mt-4 grid gap-2 md:grid-cols-2">{(["name","smtpHost","smtpUser","smtpPassword","emailFrom"] as Array<keyof SmtpForm>).map((key)=><input key={key} type={key==="smtpPassword"?"password":"text"} placeholder={({name:"Label",smtpHost:"Host",smtpUser:"Username",smtpPassword:"Password",emailFrom:"From"} as Record<string,string>)[key]} value={String(form[key] ?? "")} onChange={e=>setForm({...form,[key]:e.target.value})} className="rounded border border-m-border px-3 py-2"/>)}<button onClick={async()=>{await createSmtp({variables:{clientId,input:form}});setShowAdd(false);await refetch()}} className="rounded bg-m-primary px-3 py-2 text-white">Save profile</button></div>}<div className="mt-4 space-y-2">{data.adminSmtpProfilesByClient.map((p)=><div key={p.id} className="flex flex-wrap items-center justify-between rounded-lg border border-m-border p-3"><div><strong>{p.name}</strong><p className="text-xs text-m-text-muted">{p.smtpHost}:{p.smtpPort} · {p.emailFrom}</p></div><div className="flex gap-3"><button onClick={async()=>{const result=await testSmtp({variables:{id:p.id,clientId,to:contact}});setStatus(result.data.adminTestSmtpProfile.message)}} className="text-sm text-m-primary">Test</button><button onClick={async()=>{await deleteSmtp({variables:{id:p.id,clientId}});await refetch()}} className="text-sm text-m-error">Delete</button></div></div>)}</div></div><div className="rounded-xl border border-m-border bg-m-surface p-4"><h3 className="font-bold">Project routing</h3>{data.adminProjectsByClient.map((p)=><div key={p.id} className="mt-3 flex items-center justify-between"><code>{p.projectKey}</code><select value={p.smtpProfileId??""} onChange={async e=>{await routeSmtp({variables:{clientId,projectKey:p.projectKey,smtpProfileId:e.target.value||null}});await refetch()}} className="rounded border border-m-border p-2"><option value="">Organisation default</option>{data.adminSmtpProfilesByClient.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>)}</div>{status&&<p role="status" className="text-sm text-m-success-dark">{status}</p>}</section>;
}

function AiSettings({ settings, clientId, refetch }: { settings: AdminAiSettings; clientId: string; refetch: () => Promise<unknown> }) {
  const [form,setForm]=useState<AiSettingsForm>({...settings,apiKey:""}); const [saved,setSaved]=useState(false); const [updateAi]=useMutation(UPDATE_AI);
  return <section className="max-w-3xl space-y-4"><div><h2 className="text-xl font-bold">AI Agent</h2><p className="text-sm text-m-text-muted">Configure the assistant provider for this organisation. API keys are encrypted and never returned.</p></div><div className="space-y-4 rounded-xl border border-m-border bg-m-surface p-5"><label className="flex gap-2"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})}/> Use organisation AI configuration</label><label className="block text-sm font-semibold">Provider<select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} className="mt-1 w-full rounded border border-m-border p-2"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Google Gemini</option><option value="other">Other (OpenAI-compatible)</option></select></label>{([["displayName","Display name"],["model","Model"],["baseUrl","API base URL"],["apiKey",settings.apiKeySet?"API key (leave blank to keep existing)":"API key"]] as Array<[AiSettingsField, string]>).map(([key,label])=><label key={key} className="block text-sm font-semibold">{label}<input type={key==="apiKey"?"password":"text"} value={form[key]??""} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 w-full rounded border border-m-border p-2"/></label>)}<button onClick={async()=>{await updateAi({variables:{clientId,input:{enabled:form.enabled,provider:form.provider,displayName:form.displayName,model:form.model,baseUrl:form.baseUrl||null,apiKey:form.apiKey||null}}});setSaved(true);await refetch()}} className="rounded bg-m-primary px-4 py-2 font-bold text-white">Save AI agent settings</button>{saved&&<span className="ml-3 text-sm text-m-success-dark">Saved</span>}</div></section>;
}

function State({ text }: { text: string }) { return <div className="p-8 text-sm text-m-text-muted">{text}</div>; }
