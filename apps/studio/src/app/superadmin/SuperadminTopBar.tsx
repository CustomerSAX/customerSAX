"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Button } from "@csa/ui";

interface SuperadminTopBarProps {
  userEmail: string;
}

/**
 * Persistent top bar for the superadmin portal, visually consistent with
 * the global AppShell's yellow TopBar (csa-topbar class).
 *
 * Uses the same --topbar-* CSS custom properties as the global TopBar so
 * navigating between the regular workspace and the superadmin portal feels
 * seamless:
 *   --topbar-bg:         #F5A624 (yellow)
 *   --topbar-text:       #05082E (navy)
 *   --topbar-text-muted: rgba(5, 8, 46, 0.56)
 *   --topbar-overlay:    rgba(5, 8, 46, 0.18)
 *   --topbar-border:     #D48B0F (darker yellow)
 *
 * Sign-out calls /api/auth/logout -- no auth logic here.
 */
export function SuperadminTopBar({ userEmail }: SuperadminTopBarProps) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  };

  const isClientsActive = pathname?.startsWith("/superadmin/clients");

  return (
    <header className="csa-topbar">
      {/* Left: brand chip + nav links */}
      <div className="flex items-center gap-6">
        <Link
          href="/superadmin"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          {/* Shield chip — navy on yellow-overlay background */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--topbar-overlay)", color: "var(--topbar-text)" }}
          >
            <Icon name="shield-check" size="sm" />
          </div>
          <div className="flex flex-col leading-none">
            <span
              className="text-sm font-bold tracking-tight leading-none"
              style={{ color: "var(--topbar-text)" }}
            >
              SuperAdmin
            </span>
            <span
              className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider leading-none"
              style={{ color: "var(--topbar-text-muted)" }}
            >
              Platform Portal
            </span>
          </div>
        </Link>

        {/* Vertical divider */}
        <div className="h-5 w-px" style={{ background: "var(--topbar-overlay)" }} />

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <Link
            href="/superadmin/clients"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              color: "var(--topbar-text)",
              background: isClientsActive ? "var(--topbar-overlay)" : "transparent",
              fontWeight: isClientsActive ? 700 : 600,
            }}
          >
            <Icon name="building-2" size="xs" />
            Client Organisations
          </Link>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ color: "var(--topbar-text-muted)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--topbar-text)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--topbar-text-muted)")
            }
          >
            <Icon name="layout-dashboard" size="xs" />
            CSA Workspace
          </Link>
        </nav>
      </div>

      {/* Right: signed-in user + sign-out */}
      <div className="ml-auto flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--topbar-text-muted)" }}
          >
            Signed in as
          </span>
          <span
            className="max-w-[220px] truncate rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{
              background: "var(--topbar-overlay)",
              color: "var(--topbar-text)",
            }}
          >
            {userEmail}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<Icon name="log-out" size="xs" />}
          onClick={() => void handleSignOut()}
          style={{
            border: "1px solid var(--topbar-overlay)",
            background: "var(--topbar-overlay)",
            color: "var(--topbar-text)",
          }}
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
}
