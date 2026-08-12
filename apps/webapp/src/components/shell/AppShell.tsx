"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
  TopBar,
  SearchBar,
  Avatar,
  Badge,
  Dropdown,
  Icon,
  Button
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

const fallbackUser: CurrentUser = {
  email: "agent@csa.local",
  id: "local-agent",
  name: "CSA Agent",
  role: "admin",
  tenantId: "default",
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
    <div className="flex h-screen overflow-hidden bg-m-surface-bg font-sans text-m-text">
      {/* Meridian Sidebar */}
      <Sidebar
        brand={
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-m-lg bg-m-primary text-white font-bold shadow-m-xs">
              <Icon name="headphones" size="sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white tracking-tight leading-none">CSA Platform</span>
              <span className="text-[10px] text-m-sidebar-text mt-0.5">Meridian System</span>
            </div>
          </div>
        }
        groups={groups}
        activeItemId={activeItemId}
        onSelectItem={handleSelectItem}
        footer={
          <div className="flex items-center gap-2 text-xs text-m-sidebar-text">
            <Icon name="shield-check" size="xs" className="text-m-primary" />
            <span>GCP Enterprise v1.0</span>
          </div>
        }
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Meridian TopBar */}
        <TopBar
          brandOrBreadcrumbs={
            <div className="flex items-center gap-3">
              <Badge variant="primary" appearance="subtle" size="md" leftIcon={<Icon name="database" size="xs" />}>
                GCP Environment
              </Badge>
              {isB2bMode && (
                <Badge variant="success" appearance="subtle" size="md" leftIcon={<Icon name="building-2" size="xs" />}>
                  B2B Mode
                </Badge>
              )}
              {currentUser.projects.length > 0 && (
                <label className="flex items-center gap-2 text-xs font-semibold text-m-text-muted">
                  <span className="sr-only">Project</span>
                  <select
                    aria-label="Project"
                    value={currentUser.activeProjectKey ? `${currentUser.activeClientId ?? ""}:${currentUser.activeProjectKey}` : ""}
                    onChange={(event) => void handleProjectChange(event.target.value)}
                    className="h-8 min-w-48 rounded-m-md border border-m-border bg-m-surface px-2 text-xs font-semibold text-m-text outline-none focus:border-m-primary"
                  >
                    {!currentUser.activeProjectKey && <option value="">Select project</option>}
                    {currentUser.projects.map((project) => (
                      <option
                        key={`${project.clientId ?? "legacy"}:${project.projectKey}`}
                        value={`${project.clientId ?? ""}:${project.projectKey}`}
                      >
                        {project.displayName || project.projectKey}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          }
          searchSlot={
            <SearchBar
              placeholder="Search tickets, customers, orders..."
              shortcutHint="⌘K"
            />
          }
          actions={
            <Button variant="ghost" size="sm" iconOnly leftIcon={<Icon name="bell" size="sm" />} aria-label="Notifications" />
          }
          userSlot={
            <Dropdown
              trigger={
                <div className="flex items-center gap-2 cursor-pointer select-none">
                  <Avatar name={userDisplayName} status="online" size="sm" />
                  <div className="hidden flex-col sm:flex">
                    <span className="text-xs font-semibold text-m-text leading-none">{currentUser.email}</span>
                    <span className="text-[10px] text-m-text-muted mt-0.5">{userSubtitle}</span>
                  </div>
                  <Icon name="chevron-down" size="xs" className="text-m-text-muted" />
                </div>
              }
              items={[
                { id: "profile", label: "My Profile", icon: "user" },
                { id: "settings", label: "Org Settings", icon: "settings" },
                "divider",
                { id: "logout", label: "Sign out", icon: "log-out", danger: true, onClick: handleLogout }
              ]}
            />
          }
        />

        {/* Dynamic Page Content */}
        <main className={`flex-1 bg-m-surface-bg flex flex-col ${pathname === '/csa-assistant' ? 'overflow-hidden' : 'overflow-auto p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
