"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, Button, Icon, Modal, ModalHeader, ModalBody } from "../../components/ui";
import { personas } from "./data";
import { useDemo } from "./demo-state";

const navigation = [
  { href: "/today", label: "Priorities", icon: "layout-dashboard" },
  { href: "/accounts", label: "Accounts", icon: "building-2" },
  { href: "/commitments", label: "Commitments", icon: "list-checks" },
  { href: "/quotes", label: "Quotes & Approvals", icon: "badge-dollar-sign" },
  { href: "/service", label: "Service Watch", icon: "shield-alert" },
  { href: "/manager", label: "Back office", icon: "sliders-horizontal" }
];
export function Workspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const demo = useDemo();

  const isManager = demo.activePersonaId === "manager";

  const salesNavigation = [
    { href: "/today", label: "Priorities", icon: "layout-dashboard", count: 5 },
    { href: "/accounts", label: "Accounts", icon: "building-2" },
    { href: "/commitments", label: "Commitments", icon: "list-checks", count: 6 },
    { href: "/quotes", label: "Quotes & Approvals", icon: "badge-dollar-sign", count: 1 },
    { href: "/service", label: "Service Watch", icon: "shield-alert", count: 1 }
  ];

  const managerNavigation = [
    { href: "/manager", label: "Back Office (Manager Desk)", icon: "sliders-horizontal", count: 1 },
    { href: "/quotes", label: "Pipeline & Approvals", icon: "badge-dollar-sign", count: 1 },
    { href: "/accounts", label: "Territory Accounts", icon: "building-2" },
    { href: "/commitments", label: "Team Commitments", icon: "list-checks", count: 6 },
    { href: "/service", label: "Service Watch", icon: "shield-alert", count: 1 }
  ];

  const currentNav = isManager ? managerNavigation : salesNavigation;
  const currentPersona = isManager ? personas[2] : personas[0];
  const landing = pathname === "/";

  const handleTogglePersona = () => {
    const nextPersona = isManager ? "sales" : "manager";
    demo.setActivePersonaId(nextPersona);
    window.location.href = nextPersona === "manager" ? "/manager" : "/today";
  };

  return (
    <div className={`workspace ${landing ? "landing-shell" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {!landing && (
        <aside className={`sidebar ${menu ? "is-open" : ""}`}>
          <Link href="/" className="brand">
            <span className="brand-symbol">
              R<span>↗</span>
            </span>
            <span>
              RepMotion<small>{isManager ? "Management workspace" : "Sales workspace"}</small>
            </span>
          </Link>

          <div className="nav-label">
            {isManager ? "BRANCH MANAGEMENT DESK" : "FIELD SALES WORKSPACE"}
          </div>

          <nav aria-label="Workspace navigation">
            {currentNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                <Icon name={item.icon} size="sm" />
                <span>{item.label}</span>
                {item.count && <span className="nav-count">{item.count}</span>}
              </Link>
            ))}
          </nav>

          <div className="sidebar-note">
            <Icon name="sparkles" size="md" />
            <strong>{isManager ? "Supervise. Approve. Protect." : "Context. Clarity. Action."}</strong>
            <p>{isManager ? "Enforce gross margin floors and safeguard customer commitments." : "The right conversation starts with the full picture."}</p>
          </div>

          <div className="sidebar-footer space-y-2">
            <div className="person">
              <span className="avatar">{isManager ? "DK" : "AM"}</span>
              <div>
                <strong>{isManager ? "David Kim" : "Alex Miller"}</strong>
                <small>{isManager ? "Branch Sales Director" : "Outside AM · White Cap"}</small>
              </div>
            </div>

            {/* Explicit Demo Simulation Pill */}
            <div className="pt-2 border-t border-border/60">
              <button
                type="button"
                className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg border border-dashed border-border/80 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                onClick={handleTogglePersona}
                title="Simulation tool to preview how the Branch Director views approvals"
              >
                <span className="flex items-center gap-1.5">
                  <span>🧪</span>
                  <span>{isManager ? "Viewing Manager Desk" : "Demo: Preview Manager View"}</span>
                </span>
                <span className="text-[10px] font-semibold text-primary">Switch</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="workspace-body">
        <header className="topbar">
          <div className="topbar-left">
            {!landing && (
              <Button
                variant="secondary"
                className="menu-button"
                onClick={() => setMenu(!menu)}
                aria-label="Toggle navigation"
                aria-expanded={menu}
                leftIcon={<Icon name="menu" size="sm" />}
              />
            )}
            {landing ? (
              <Link href="/" className="brand top-brand">
                <span className="brand-symbol">
                  R<span>↗</span>
                </span>
                <span>
                  RepMotion<small>Sales Workspace</small>
                </span>
              </Link>
            ) : (
              <div>
                <span className="topbar-eyebrow">
                  {isManager ? "BRANCH LEADERSHIP · COMMERCIAL SALES DIRECTOR" : "COMMERCIAL SALES · FIELD ACCOUNT EXECUTIVE"}
                </span>
                <strong>
                  {currentNav.find((item) => item.href === pathname)?.label ||
                    (isManager ? "Branch Management Desk" : "Sales Workspace")}
                </strong>
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <Button
              size="sm"
              variant="secondary"
              className="text-xs hidden sm:inline-flex items-center gap-1.5 font-medium"
              onClick={handleTogglePersona}
              leftIcon={<Icon name="repeat-2" size="xs" />}
            >
              Role: <strong>{isManager ? "Sales Manager" : "Sales Rep"}</strong>
            </Button>
            <Badge variant="neutral">Enterprise SaaS</Badge>
            {!landing && (
              <>
                <Button
                  variant="secondary"
                  aria-label={`Open notifications (${demo.notifications.length})`}
                  onClick={() => setNotifications(true)}
                  leftIcon={<Icon name="bell" size="sm" />}
                >
                  {demo.notifications.length}
                </Button>
                <span className="avatar top-avatar" title={currentPersona.name}>
                  {currentPersona.initials}
                </span>
              </>
            )}
          </div>
        </header>
        <div className="demo-banner">
          <span className="demo-dot" />
          Connected Enterprise Platform<span className="banner-separator">·</span>Multi-Tenant Business Intelligence<span className="banner-separator">·</span>Real-Time Commercial Signals
        </div>
        <main id="main-content" tabIndex={-1} className="page-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>RepMotion Studio</span>
          <span>Sample workspace · Changes reset on reload</span>
        </footer>
      </div>
      <Modal isOpen={notifications} onClose={() => setNotifications(false)}>
        <ModalHeader
          title="Workspace notifications"
          subtitle="Sample updates across sales, customer care, and management."
          onClose={() => setNotifications(false)}
        />
        <ModalBody>
          <div className="rows">
            {demo.notifications.map((item) => (
              <div className="notification-row" key={item.id}>
                <span className="icon-tile">
                  <Icon name="bell" size="sm" />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>{item.time}</small>
                </div>
              </div>
            ))}
          </div>
        </ModalBody>
      </Modal>
      {demo.message && (
        <div className="toast" role="status">
          <Icon name="circle-check" size="sm" />
          <span>{demo.message}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => demo.setMessage("")}
          >
            <Icon name="x" size="sm" />
          </button>
        </div>
      )}
    </div>
  );
}
