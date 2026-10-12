"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, Button, Icon, Modal, ModalHeader, ModalBody } from "../../components/ui";
import { personas } from "./data";
import { useDemo } from "./demo-state";

const navigation = [
  { href: "/today", label: "Today", icon: "layout-dashboard" },
  { href: "/accounts/summit", label: "Account brief", icon: "building-2" },
  { href: "/commitments", label: "Commitments", icon: "list-checks" },
  { href: "/service", label: "Customer care", icon: "headset" },
  { href: "/manager", label: "Back office", icon: "sliders-horizontal" },
  { href: "/demo-flow", label: "Demo flow", icon: "route" }
];
export function Workspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const demo = useDemo();
  const persona = personas[pathname === "/service" ? 1 : pathname === "/manager" ? 2 : 0];
  const landing = pathname === "/";
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
              RepMotion<small>Sales workspace</small>
            </span>
          </Link>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Workspace navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                <Icon name={item.icon} size="sm" />
                <span>{item.label}</span>
                {item.href === "/today" && <span className="nav-count">5</span>}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <Icon name="sparkles" size="md" />
            <strong>Context. Clarity. Action.</strong>
            <p>The right conversation starts with the full picture.</p>
          </div>
          <div className="sidebar-footer">
            <div className="person">
              <span className="avatar">{persona.initials}</span>
              <div>
                <strong>{persona.name}</strong>
                <small>{persona.role}</small>
              </div>
            </div>
            <Link href="/" className="switch-role">
              <Icon name="repeat-2" size="sm" />
              Switch demo persona
            </Link>
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
                  RepMotion<small>White Cap POC</small>
                </span>
              </Link>
            ) : (
              <div>
                <span className="topbar-eyebrow">WHITE CAP · MIDWEST</span>
                <strong>
                  {navigation.find((item) => item.href === pathname)?.label ||
                    "Sales workspace"}
                </strong>
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <span className="sample-date">Tuesday, October 6, 2026</span>
            <Badge variant="neutral">Demo workspace</Badge>
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
                <span className="avatar top-avatar" title={persona.name}>
                  {persona.initials}
                </span>
              </>
            )}
          </div>
        </header>
        <div className="demo-banner">
          <span className="demo-dot" />
          Illustrative POC<span className="banner-separator">·</span>Fictional accounts
          and sample data<span className="banner-separator">·</span>No live White Cap
          connection
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
