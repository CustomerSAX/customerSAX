"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
  TopBar,
  Avatar,
  Dropdown,
  Icon
} from "@csa/ui";
import { useCurrentUser, roleLabel, type CurrentUser } from "@/lib/use-current-user";
import { apolloClient } from "@/graphql/client";

const sidebarGroups: SidebarGroup[] = [
  {
    id: "operations",
    title: "Operations",
    items: [
      { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" },
      { id: "tickets", href: "/tickets", label: "Tickets", icon: "ticket-check" },
      { id: "customers", href: "/customers", label: "Customers", icon: "users" }
    ]
  },
  {
    id: "commerce",
    title: "Commerce",
    items: [
      { id: "orders", href: "/orders", label: "Orders", icon: "shopping-bag" },
      { id: "cart", href: "/cart", label: "Cart", icon: "shopping-cart" },
      { id: "products", href: "/products", label: "Products", icon: "package" }
    ]
  },
  {
    id: "intelligence",
    title: "Intelligence",
    items: [
      { id: "reports", href: "/reports", label: "Reports", icon: "bar-chart-3" },
      { id: "knowledgebase", href: "/knowledgebase", label: "Knowledge Base", icon: "book-open" },
      { id: "csa-assistant", href: "/csa-assistant", label: "CSA Assistant", icon: "sparkles" }
    ]
  },
  {
    id: "administration",
    title: "Administration",
    items: [{ id: "audit-log", href: "/admin/audit-log", label: "Audit Log", icon: "lock" }]
  }
];

const b2bSidebarGroup: SidebarGroup = {
  id: "b2b-operations",
  title: "B2B Operations",
  items: [
    { id: "b2b-company", href: "/b2b/company", label: "Companies", icon: "building-2" },
    { id: "b2b-employees", href: "/b2b/employees", label: "Employees", icon: "user-check" },
    { id: "b2b-quotes", href: "/b2b/quotes", label: "Quotes", icon: "file-text" },
    { id: "b2b-import-export", href: "/b2b/import-export", label: "Import / Export", icon: "arrow-left-right" }
  ]
};

// FAIL-CLOSED: when /api/auth/me hasn't resolved (or failed), we must NOT render
// the console as an administrator. This fallback is a NON-privileged identity —
// role "agent", no projects — so a failed/absent session never exposes admin-only
// navigation (Admin Settings, Superadmin). The real authenticated user, when it
// loads, replaces this entirely; the middleware still gates page access by cookie.
const fallbackUser: CurrentUser = {
  email: "",
  id: "unauthenticated",
  name: "CSA Agent",
  role: "agent",
  tenantId: "",
  projects: [],
  requiresProjectSelection: false
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const currentUser = user ?? fallbackUser;

  useEffect(() => {
    if (user?.requiresProjectSelection) {
      router.replace(`/select-project?callbackUrl=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [pathname, router, user?.requiresProjectSelection]);

  const userDisplayName = currentUser.name || currentUser.email;
  const userSubtitle = useMemo(() => roleLabel(currentUser.role), [currentUser.role]);

  const isB2bMode = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_PROJECT_TYPE === "B2B" ||
      process.env.NEXT_PUBLIC_CT_BUSINESS_TYPE === "B2B" ||
      pathname?.startsWith("/b2b")
    );
  }, [pathname]);

  const groups = useMemo(() => {
    let baseGroups = [...sidebarGroups];
    if (isB2bMode) {
      // Insert B2B Operations right after Commerce
      const commerceIdx = baseGroups.findIndex((g) => g.id === "commerce");
      if (commerceIdx !== -1) {
        baseGroups.splice(commerceIdx + 1, 0, b2bSidebarGroup);
      } else {
        baseGroups.push(b2bSidebarGroup);
      }
    }
    baseGroups = baseGroups.map((group) =>
      group.id === "administration"
        ? {
            ...group,
            items: [
              ...((currentUser.role === "admin" || currentUser.role === "superadmin")
                ? [{ id: "admin-settings", href: "/admin/users", label: "Admin Settings", icon: "settings" } as SidebarItem]
                : []),
              ...group.items,
              ...(currentUser.role === "superadmin"
                ? [{ id: "superadmin", href: "/superadmin", label: "Superadmin", icon: "shield-check" } as SidebarItem]
                : [])
            ]
          }
        : group
    );
    return baseGroups;
  }, [currentUser.role, isB2bMode]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  const handleProjectChange = async (selection: string) => {
    const project = currentUser.projects.find(
      (candidate) => `${candidate.clientId ?? ""}:${candidate.projectKey}` === selection
    );
    if (!project) return;

    const response = await fetch("/api/auth/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectKey: project.projectKey, clientId: project.clientId })
    });
    if (!response.ok) return;

    await apolloClient.clearStore();
    window.location.assign(pathname || "/dashboard");
  };

  const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";

  // The projects list can legitimately contain exact duplicates (the same
  // clientId:projectKey returned twice) and distinct projects that happen to
  // share a display name. De-dupe the former by identity, and disambiguate the
  // latter in the option label so the rep can tell them apart — without ever
  // altering the real display names themselves.
  const uniqueProjects = useMemo(() => {
    const seen = new Set<string>();
    return currentUser.projects.filter((project) => {
      const key = `${project.clientId ?? ""}:${project.projectKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [currentUser.projects]);

  const projectOptionLabel = (project: CurrentUser["projects"][number]) => {
    const base = project.displayName || project.projectKey;
    const collides =
      uniqueProjects.filter((candidate) => (candidate.displayName || candidate.projectKey) === base).length > 1;
    if (!collides) return base;
    // Same display name across different projects → append the projectKey (and
    // clientId when even that matches) so each option is uniquely identifiable.
    const keyCollides =
      uniqueProjects.filter(
        (candidate) => (candidate.displayName || candidate.projectKey) === base && candidate.projectKey === project.projectKey
      ).length > 1;
    return keyCollides ? `${base} · ${project.projectKey} · ${project.clientId ?? "—"}` : `${base} · ${project.projectKey}`;
  };

  // Find active item ID
  let activeItemId = "dashboard";
  for (const group of groups) {
    for (const item of group.items) {
      if (
        item.href &&
        (pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)) ||
          (item.href === "/dashboard" && pathname === "/"))
      ) {
        activeItemId = item.id;
      }
    }
  }

  const handleSelectItem = (item: SidebarItem) => {
    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-ink)' }}
    >
      {/* ── CSA Sidebar ──────────────────────────── */}
      <Sidebar
        brand={
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--csa-yellow-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--csa-navy-950)', lineHeight: 1 }}>C</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--csa-white)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                customerSAX
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--sidebar-text)',
                  marginTop: 1,
                }}
              >
                Studio
              </span>
            </div>
          </div>
        }
        groups={groups}
        activeItemId={activeItemId}
        onSelectItem={handleSelectItem}
        footer={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--text-xs)',
              color: 'var(--sidebar-text)',
            }}
          >
            <Icon name="shield-check" size="xs" style={{ color: 'var(--csa-yellow-500)', flexShrink: 0 }} />
            <span>Enterprise v1.0</span>
          </div>
        }
      />

      {/* ── Main area ────────────────────────────── */}
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{ background: 'var(--color-bg)' }}
      >
        {/* ── Yellow TopBar ─────────────────────── */}
        <TopBar
          brandOrBreadcrumbs={
            <div className="flex items-center gap-3">
              {isB2bMode && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(5,8,46,0.12)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--topbar-text)',
                  }}
                >
                  <Icon name="building-2" size="xs" />
                  B2B Mode
                </span>
              )}
              {currentUser.projects.length > 0 && (
                <select
                  aria-label="Project"
                  value={currentUser.activeProjectKey ? `${currentUser.activeClientId ?? ""}:${currentUser.activeProjectKey}` : ""}
                  onChange={(event) => void handleProjectChange(event.target.value)}
                  style={{
                    height: 34,
                    minWidth: 170,
                    maxWidth: 240,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--topbar-overlay)',
                    background: 'rgba(255,255,255,0.25)',
                    padding: '0 12px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--topbar-text)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {!currentUser.activeProjectKey && <option value="">Select project</option>}
                  {uniqueProjects.map((project) => (
                    <option
                      key={`${project.clientId ?? "legacy"}:${project.projectKey}`}
                      value={`${project.clientId ?? ""}:${project.projectKey}`}
                    >
                      {projectOptionLabel(project)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          }
          searchSlot={
            <div
              className="flex items-center gap-2"
              style={{
                background: 'var(--topbar-search-bg)',
                border: '1px solid var(--topbar-search-border)',
                borderRadius: 'var(--radius-full)',
                padding: '0 16px',
                height: 40,
                width: '100%',
                maxWidth: 480,
                margin: '0 auto',
              }}
            >
              <Icon name="search" size="sm" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="search"
                placeholder="Search customers, orders, tickets..."
                aria-label="Global search"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink)',
                  minWidth: 0,
                }}
              />
              <kbd
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  background: 'var(--color-surface-3)',
                  flexShrink: 0,
                }}
              >
                ⌘K
              </kbd>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              {/* Features removed until workflows are built */}
            </div>
          }
          userSlot={
            <Dropdown
              trigger={
                <div
                  className="flex items-center gap-2 cursor-pointer select-none"
                  style={{ padding: '4px 8px 4px 4px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.18)' }}
                >
                  <Avatar name={userDisplayName} status="online" size="sm" />
                  <div className="hidden flex-col sm:flex">
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--topbar-text)',
                        lineHeight: 1.1,
                      }}
                    >
                      {userDisplayName}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--topbar-text-muted)',
                        marginTop: 1,
                      }}
                    >
                      {userSubtitle}
                    </span>
                  </div>
                  <Icon name="chevron-down" size="xs" style={{ color: 'var(--topbar-text-muted)' }} />
                </div>
              }
              items={[
                { id: "profile", label: "My Profile", icon: "user", onClick: () => router.push("/profile") },
                ...(isAdmin
                  ? [{ id: "settings", label: "Org Settings", icon: "settings", onClick: () => router.push("/admin/users") }]
                  : []),
                "divider",
                { id: "logout", label: "Sign out", icon: "log-out", danger: true, onClick: handleLogout }
              ]}
            />
          }
        />

        {/* ── Page content ─────────────────────── */}
        <main
          className={`flex-1 flex flex-col ${
            pathname === '/csa-assistant' ? 'overflow-hidden' : 'overflow-auto'
          }`}
          style={{
            padding: pathname === '/csa-assistant' ? 0 : '28px 32px',
            background: 'var(--color-bg)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
