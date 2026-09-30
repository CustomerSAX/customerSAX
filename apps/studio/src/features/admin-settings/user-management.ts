export type ClientProjectMembership = {
  projectKey: string;
  role: string;
};

export type AdminUserRow = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  active: boolean;
  clientProjects: ClientProjectMembership[];
};

/**
 * Computes available existing organization users for a project:
 * Available Users = Organization Users − Current Project Users.
 * Optionally filters out any emails added in the current modal session.
 */
export function getAvailableExistingUsers(
  orgUsers: AdminUserRow[],
  projectKey: string,
  justAddedEmails: string[] = []
): AdminUserRow[] {
  const added = new Set(justAddedEmails.map((e) => e.toLowerCase()));
  return orgUsers.filter(
    (user) =>
      !added.has(user.email.toLowerCase()) &&
      !user.clientProjects?.some((p) => p.projectKey === projectKey)
  );
}

/**
 * Checks whether an email matches an existing organization user,
 * and whether they are already assigned to the target project.
 */
export function checkUserConflict(
  orgUsers: AdminUserRow[],
  projectKey: string,
  email: string
): { isMemberOfCurrentProject: boolean; userInOrg?: AdminUserRow } {
  const trimmed = email.trim().toLowerCase();
  const existingInOrg = orgUsers.find((u) => u.email.toLowerCase() === trimmed);
  if (!existingInOrg) {
    return { isMemberOfCurrentProject: false };
  }
  const isMemberOfCurrentProject = Boolean(
    existingInOrg.clientProjects?.some((p) => p.projectKey === projectKey)
  );
  return { isMemberOfCurrentProject, userInOrg: existingInOrg };
}
