"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronDown,
  Database,
  Headphones,
  LayoutDashboard,
  Lock,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TicketCheck,
  Users,
  type LucideIcon
} from "lucide-react";

const navGroups: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: LucideIcon; badge?: string }>;
}> = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tickets", label: "Tickets", icon: TicketCheck, badge: "12" },
      { href: "/customers", label: "Customers", icon: Users }
    ]
  },
  {
    label: "Commerce",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingBag },
      { href: "/cart", label: "Cart", icon: ShoppingCart },
      { href: "/products", label: "Products", icon: Package }
    ]
  },
  {
    label: "Intelligence",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/knowledgebase", label: "Knowledge Base", icon: BookOpen },
      { href: "/csa-assistant", label: "CSA Assistant", icon: Sparkles }
    ]
  },
  {
    label: "Administration",
    items: [{ href: "/admin/audit-log", label: "Audit Log", icon: Lock }]
  }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-csa-bg font-sans text-csa-navy">
      <aside
        aria-label="Main navigation"
        className="csa-sidebar-surface flex h-screen w-[260px] min-w-[260px] flex-col overflow-hidden border-r border-white/10 text-blue-50"
      >
        <div className="px-4 pb-5 pt-5">
          <div className="flex items-center gap-3 rounded-panel border border-white/10 bg-white/10 p-3.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F97316] text-white shadow-[0_16px_24px_-18px_rgba(249,115,22,0.60)]">
              <Headphones size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold leading-tight text-slate-100">
                CSA Operations
              </div>
              <div className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-[#CFE0EE]/55">
                Customer 360 workspace
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 pb-5">
          {navGroups.map((group) => (
            <div className="mb-6" key={group.label}>
              <div className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#CFE0EE]/50">
                {group.label}
              </div>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)) ||
                    (item.href === "/dashboard" && pathname === "/");
                  const Icon = item.icon;

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "group relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-all duration-150 ease-enterprise",
                        isActive
                          ? "bg-[rgba(249,115,22,0.16)] text-white shadow-[inset_3px_0_0_#F97316]"
                          : "text-[#CFE0EE]/75 hover:bg-white/10 hover:text-white"
                      ].join(" ")}
                      href={item.href}
                      key={item.href}
                    >
                      <span
                        className={[
                          "grid h-7 w-7 shrink-0 place-items-center rounded-md transition-all duration-150",
                          isActive ? "text-white" : "text-[#CFE0EE]/55 group-hover:text-white"
                        ].join(" ")}
                      >
                        <Icon size={16} strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F97316] px-1.5 text-[10px] font-bold text-white shadow-sm">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-50 flex h-[68px] shrink-0 items-center justify-between gap-5 border-b border-csa-border bg-[var(--topbar-bg)] px-6 backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <div className="flex h-10 items-center gap-2 rounded-control border border-csa-border bg-white px-3 text-[13px] font-medium text-csa-navy shadow-sm">
              <Database size={15} className="text-csa-muted" />
              <span className="max-w-[260px] truncate">CSA GCP Environment</span>
              <ChevronDown size={15} className="text-csa-muted" />
            </div>

            <button
              type="button"
              aria-label="Open global search"
              className="csa-input-shell hidden h-10 max-w-[480px] flex-1 cursor-text px-3.5 xl:flex"
            >
              <Search size={16} className="shrink-0 text-csa-muted" />
              <span className="min-w-0 flex-1 text-left text-[13px] font-normal text-slate-400">
                Search customers, orders, tickets...
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-csa-border bg-csa-surface-2 px-1.5 py-1 text-[10px] font-medium text-csa-muted">
                Ctrl K
              </span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className="grid h-10 w-10 place-items-center rounded-full border border-csa-border bg-white text-csa-muted shadow-sm transition hover:border-csa-border-strong hover:text-csa-navy"
            >
              <Bell size={16} />
            </button>
            <div className="hidden min-w-0 flex-col items-end lg:flex">
              <span className="max-w-[220px] truncate text-[12px] font-medium leading-tight text-csa-navy">
                agent@csa.local
              </span>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-primary-700">
                <ShieldCheck size={10} />
                Admin
              </span>
            </div>
            <button
              type="button"
              aria-label="Account menu"
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-900 bg-csa-navy text-[12px] font-semibold tracking-wide text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"
            >
              SA
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-csa-bg px-[clamp(24px,3vw,44px)] py-[clamp(24px,2.6vw,38px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
