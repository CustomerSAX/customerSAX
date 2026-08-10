"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

type CurrentUser = {
  email: string;
  id: string;
  name: string;
  role: "agent" | "admin" | "superadmin";
  tenantId: string;
};

const fallbackUser: CurrentUser = {
  email: "agent@csa.local",
  id: "local-agent",
  name: "CSA Agent",
  role: "admin",
  tenantId: "default"
};

function roleLabel(role: CurrentUser["role"]) {
  const labels: Record<CurrentUser["role"], string> = {
    agent: "CSA Agent",
    admin: "CSA Administrator",
    superadmin: "CSA Super Administrator"
  };

  return labels[role];
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser>(fallbackUser);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);

      if (!response?.ok) {
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!cancelled && payload?.user?.email) {
        setCurrentUser({ ...fallbackUser, ...payload.user });
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const userDisplayName = currentUser.name || currentUser.email;
  const userSubtitle = useMemo(() => roleLabel(currentUser.role), [currentUser.role]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  // Find active item ID
  let activeItemId = "dashboard";
  for (const group of sidebarGroups) {
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
        groups={sidebarGroups}
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
