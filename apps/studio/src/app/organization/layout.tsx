/**
 * Dedicated Organization Settings layout.
 *
 * Exists outside the normal Studio application layout (no AppShell):
 * - No Studio sidebar
 * - No project selector
 * - No project-scoped layout elements
 *
 * Provides a standalone organization-level management experience for Organization Admins.
 * Enforces server-side authorization: only users with role "admin" (Org Admin)
 * or "superadmin" can access this route. All other users are redirected.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import { ROLES } from "@/constants";
import { OrganizationTopBar } from "./OrganizationTopBar";
import { NotificationToaster } from "@/features/notifications/NotificationCenter";

interface OrganizationLayoutProps {
  children: React.ReactNode;
}

export default async function OrganizationLayout({ children }: OrganizationLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/organization");
  }

  // Strict role enforcement: only Organization Admins and Superadmins can access
  if (user.role !== ROLES.admin && user.role !== ROLES.superadmin) {
    redirect("/dashboard");
  }

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
        <OrganizationTopBar
          userEmail={user.email}
          organizationName={user.organization?.name}
          role={user.role}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <NotificationToaster />
      </div>
    </div>
  );
}
