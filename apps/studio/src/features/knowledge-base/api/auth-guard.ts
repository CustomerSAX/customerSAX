import { getCurrentUser, type CurrentUser } from "@/lib/get-current-user";

export async function authorizeOrganizationAccess(
  organizationId: string,
  requireAdmin = false
): Promise<{ authorized: boolean; errorResponse?: Response; user?: CurrentUser }> {
  const user = await getCurrentUser();

  const isDevBypass =
    process.env.NODE_ENV === "development" && process.env.SKIP_AUTH === "1";

  if (!user && !isDevBypass) {
    return {
      authorized: false,
      errorResponse: Response.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    };
  }

  if (isDevBypass && !user) {
    return { authorized: true };
  }

  if (!user) {
    return {
      authorized: false,
      errorResponse: Response.json({ error: "Unauthorized." }, { status: 401 })
    };
  }

  // Superadmin has full cross-organization administrative access
  if (user.role === "superadmin") {
    return { authorized: true, user };
  }

  // Validate tenant / organization membership
  const userOrgMatches =
    user.activeClientId === organizationId ||
    user.organization?.id === organizationId ||
    user.organization?.slug === organizationId ||
    user.tenantId === organizationId ||
    user.projects?.some((p) => p.clientId === organizationId);

  if (!userOrgMatches) {
    return {
      authorized: false,
      errorResponse: Response.json(
        { error: "Forbidden. You do not have access to this organization's knowledge base." },
        { status: 403 }
      ),
      user
    };
  }

  if (requireAdmin && user.role !== "admin") {
    return {
      authorized: false,
      errorResponse: Response.json(
        { error: "Forbidden. Administrator permissions required to manage knowledge base." },
        { status: 403 }
      ),
      user
    };
  }

  return { authorized: true, user };
}
