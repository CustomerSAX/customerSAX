/**
 * Superadmin portal layout.
 *
 * Completely separate from the regular app's AppShell — no sidebar, no
 * agent nav. The superadmin is a platform-level identity who manages client
 * organizations, not a CSA agent working tickets/orders.
 *
 * Auth is the real session system (see lib/get-current-user.ts) — this
 * layout only adds a role check on top of it, matching the read-only
 * "defense in depth" pattern already used elsewhere; it does not implement
 * its own auth.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/get-current-user';
import { ROLES } from '@/constants';
import { SuperadminTopBar } from './SuperadminTopBar';

interface SuperadminLayoutProps {
  children: React.ReactNode;
}

export default async function SuperadminLayout({ children }: SuperadminLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?callbackUrl=/superadmin');
  }

  if (user.role !== ROLES.superadmin) {
    redirect('/dashboard');
  }

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
    >
      {/* No agent sidebar — superadmin is platform-level, not project-scoped */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
        <SuperadminTopBar userEmail={user.email} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
