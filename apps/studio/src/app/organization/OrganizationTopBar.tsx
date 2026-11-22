"use client";

import Link from "next/link";
import { Icon, Button } from "@csa/ui";

interface OrganizationTopBarProps {
  userEmail: string;
  organizationName?: string;
  role: string;
}

/**
 * Top bar for the Organization Settings portal.
 *
 * Operates completely outside the standard project-specific AppShell:
 * - No Studio sidebar
 * - No project selector
 * - Clean organization-level context
 *
 * Visually consistent with the CSA design system using standard topbar tokens.
 */
export function OrganizationTopBar({
  userEmail,
  organizationName,
  role
}: OrganizationTopBarProps) {
  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  };

  return (
    <header className="csa-topbar">
      {/* Left: Organization brand icon + Title + Back to Studio */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--topbar-overlay)", color: "var(--topbar-text)" }}
          >
            <Icon name="building-2" size="sm" />
          </div>
          <div className="flex flex-col leading-none">
            <span
              className="text-sm font-bold tracking-tight leading-none"
              style={{ color: "var(--topbar-text)" }}
            >
              {organizationName || "Organization Settings"}
            </span>
            <span
              className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider leading-none"
              style={{ color: "var(--topbar-text-muted)" }}
            >
              Organization Management Portal
            </span>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="h-5 w-px" style={{ background: "var(--topbar-overlay)" }} />

        {/* Navigation link back to Studio Workspace */}
        <nav className="flex items-center gap-1">
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
            <Icon name="arrow-left" size="xs" />
            Back to Studio
          </Link>
        </nav>
      </div>

      {/* Right: user info & sign out */}
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
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "var(--topbar-overlay)",
              color: "var(--topbar-text)"
            }}
          >
            {role === "superadmin" ? "Superadmin" : "Org Admin"}
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
