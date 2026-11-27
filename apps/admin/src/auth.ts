export type AdminContext = {
  clientId?: string;
  projectKey?: string;
  userRole?: string;
  userEmail?: string;
  userIsOrgAdmin?: boolean;
};

/**
 * DEFAULT-DENY classification for `admin*` fields.
 *
 * Explicit allowlist of the fields a client-scoped admin (role `admin`, bound
 * to a single `clientId`) may invoke — each still constrained to that admin's
 * OWN client by the org-scoping check in `authorize()`. Anything NOT listed
 * here — including any newly added `admin*` query/mutation — is treated as
 * SUPERADMIN-ONLY. Adding a new admin field therefore fails closed (superadmin
 * required) instead of silently downgrading to client-scoped access; add it
 * here deliberately if and only if a client-scoped admin should reach it.
 */
export const clientScopedAdminFields = new Set([
  // Reads scoped to the caller's own client
  "adminClient", "adminProject", "adminProjectsByClient", "adminUsersByClient",
  "adminRoles", "adminAiSettings", "adminSmtpProfilesByClient",
  "adminProjectTicketing", "adminProjectTicketingSla",
  // Client-scoped project & commerce management (Org Admin ownership)
  "adminCreateProject", "adminUpdateProject", "adminDeleteProject",
  "adminTestProjectCredentials", "adminTestProjectConnection",
  "adminSaveProjectTicketing", "adminSaveProjectTicketingSla", "adminTestProjectTicketing",
  // Client-scoped user/role management
  "adminAssignClientUser", "adminCreateClientUser", "adminUpdateClientUser",
  "adminRemoveUserFromClient", "adminRemoveUserFromProject", "adminUpdateClientContact",
  "adminCreateRole", "adminUpdateRole", "adminDeleteRole",
  // Client-scoped AI + SMTP configuration
  "adminUpdateAiSettings", "adminCreateSmtpProfile", "adminUpdateSmtpProfile",
  "adminDeleteSmtpProfile", "adminSetProjectSmtp", "adminTestSmtpProfile",
  // Client-scoped Organization updates
  "adminUpdateClient", "adminDeleteClient"
]);

export const orgAdminOnlyFields = new Set([
  "adminCreateProject",
  "adminDeleteProject",
  "adminUpdateClient",
  "adminDeleteClient",
  "adminUpdateClientContact"
]);

export function authorize(field: string, args: Record<string, unknown>, context: AdminContext) {
  if (context.userRole === "superadmin") return;
  if (context.userRole !== "admin" || !context.clientId || !context.userEmail) {
    throw new Error("Administrator access is required");
  }

  // Default-deny: only fields explicitly classified as client-scoped are
  // reachable by a client-scoped admin; every other admin* field (known
  // superadmin-only fields AND any unclassified/new field) requires superadmin.
  if (!clientScopedAdminFields.has(field)) throw new Error("Superadmin access is required");

  // Organization-level management and project creation require Organization Admin or Superadmin
  if (orgAdminOnlyFields.has(field) && !context.userIsOrgAdmin) {
    throw new Error("Organization Administrator access is required");
  }

  let requestedClientId: string | undefined = typeof args.clientId === "string" ? args.clientId : undefined;
  if (!requestedClientId) {
    if (typeof args.id === "string" && (field === "adminClient" || field === "adminUpdateClient" || field === "adminDeleteClient")) {
      requestedClientId = args.id;
    }
  }
  if (requestedClientId && requestedClientId !== context.clientId) {
    throw new Error("Cannot access another organisation");
  }
}
