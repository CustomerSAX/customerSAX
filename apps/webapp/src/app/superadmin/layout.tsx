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
import Link from 'next/link';
import { getCurrentUser } from '@/lib/get-current-user';
import { ROLES } from '@/constants';
import { Icon } from '@csa/ui';
import { SignOutButton } from './SignOutButton';

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
    <div className="min-h-screen bg-m-surface-bg">
      <header className="flex items-center justify-between border-b border-m-border bg-m-surface px-6 py-3.5">
        <Link href="/superadmin/clients" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-m-lg bg-m-primary text-white shadow-m-xs">
            <Icon name="shield-check" size="sm" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-m-text leading-none">CSA Superadmin</span>
            <span className="text-[10px] text-m-text-muted mt-0.5">Platform administration</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-m-text-muted hover:text-m-text"
          >
            <Icon name="arrow-left" size="xs" />
            CSA Workspace
          </Link>
          <span className="h-4 w-px bg-m-border" />
          <span className="text-xs text-m-text-muted">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
