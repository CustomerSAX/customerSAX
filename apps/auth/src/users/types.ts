export type AuthRole = "agent" | "admin" | "superadmin";

export type AuthUserProject = {
  clientId?: string;
  displayName?: string;
  projectKey: string;
  role: string;
  shellMode?: "b2c" | "b2b";
};

export type AuthUser = {
  _id?: unknown;
  active: boolean;
  email: string;
  firstName?: string;
  id: string;
  lastName?: string;
  name: string;
  passwordHash: string;
  projects?: AuthUserProject[];
  defaultProjectKey?: string;
  projectKey?: string;
  role: AuthRole;
  tenantId: string;
};

export type SessionRecord = {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  revokedAt?: Date;
  tokenHash: string;
  userId: string;
  activeClientId?: string;
  activeProjectKey?: string;
};

export type PublicUser = {
  email: string;
  id: string;
  name: string;
  projectKey?: string;
  activeClientId?: string;
  activeProjectKey?: string;
  activeProjectShellMode?: "b2c" | "b2b";
  projects: AuthUserProject[];
  requiresProjectSelection: boolean;
  role: AuthRole;
  tenantId: string;
};

export function projectsForUser(user: AuthUser): AuthUserProject[] {
  const projects = (user.projects ?? []).filter((project) => Boolean(project.projectKey?.trim()));
  if (projects.length > 0) return projects;
  return user.projectKey ? [{ projectKey: user.projectKey, role: user.role }] : [];
}

export function toPublicUser(user: AuthUser, activeProjectKey?: string, activeClientId?: string): PublicUser {
  const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const id = user.id || String(user._id ?? user.email);
  const projects = projectsForUser(user);
  const implicitProject = projects.length === 1 ? projects[0] : undefined;
  const effectiveProjectKey = activeProjectKey ?? implicitProject?.projectKey;
  const effectiveClientId = activeClientId ?? implicitProject?.clientId;
  const activeMembership = projects.find((project) => project.projectKey === effectiveProjectKey && (!effectiveClientId || project.clientId === effectiveClientId));
  const effectiveRole: AuthRole = user.role === "superadmin" ? "superadmin" : activeMembership?.role === "admin" ? "admin" : "agent";

  return {
    email: user.email,
    id,
    name,
    projectKey: effectiveProjectKey ?? user.projectKey,
    activeProjectKey: effectiveProjectKey,
    activeClientId: effectiveClientId,
    projects,
    requiresProjectSelection: user.role !== "superadmin" && projects.length !== 1 && !effectiveProjectKey,
    role: effectiveRole,
    tenantId: user.tenantId
  };
}
