"use client";

/**
 * customerSAX — Back-office Entity Detail design system
 * ------------------------------------------------------
 * A single, opinionated set of primitives that every entity detail page
 * (Order / Customer / Product / Cart / Ticket / Return …) composes. The goal,
 * per the UI spec, is "reproduce the design language, not the screenshot":
 *
 *   EntityHeader  →  EntityTabs  →  SummaryGrid  →  ContentGrid( cards / timeline / quick actions / context )
 *
 * ALL visual decisions (spacing, borders, radii, typography, colour) live here
 * and are expressed through Meridian tokens (`m-*` classes / CSS vars) — never
 * raw hex. Pages supply structure + data only, so five different entities read
 * as one professionally designed product.
 *
 * Visual contract (from spec):
 *   - working canvas stays calm: white cards, 1px `--color-border`, radius 12px,
 *     whisper shadow. No gradients / glass / glow in the content area.
 *   - hierarchy comes from size + spacing + weight, not bold-everything.
 *   - tabs = quiet horizontal sub-nav, single 2px blue underline, full-width divider.
 *   - amber is reserved for "these controls change something" (Quick Actions).
 */

import type { ReactNode } from "react";
import { Icon } from "../../icons/Icon";
import { Dropdown } from "../overlays/Dropdown";

/* ------------------------------------------------------------------ *
 * Page shell + rhythm
 * ------------------------------------------------------------------ */

export function DetailPage({ children }: { children: ReactNode }) {
  // max-width keeps dense operational screens readable on ultrawide monitors
  // without stretching a 12-col grid into unusable line lengths.
  return <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">{children}</div>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-m-primary transition-colors hover:text-m-primary-600"
    >
      <Icon name="arrow-left" size={15} />
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ *
 * Entity header — back link is rendered by the page above this.
 * Title + status on one line, one quiet metadata line, right-aligned actions.
 * Deliberately NOT wrapped in a card/banner — the top of the page stays open.
 * ------------------------------------------------------------------ */

export function EntityHeader({
  title,
  status,
  meta,
  actions,
}: {
  title: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="relative z-[var(--z-dropdown)] flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-m-text sm:text-[28px]">
            {title}
          </h1>
          {status}
        </div>
        {meta && <div className="text-[13px] leading-snug text-m-text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Entity tabs — quiet sub-navigation. Sticky so it stays reachable on long
 * entity pages. Single 2px active underline, full-width neutral divider.
 * Controlled: the page owns the active-tab state.
 * ------------------------------------------------------------------ */

export interface EntityTab {
  id: string;
  label: string;
  icon?: string;
  count?: number | null;
}

export function EntityTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: EntityTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="sticky z-20 flex items-end gap-8 overflow-x-auto border-b border-m-border"
      style={{
        top: "var(--topbar-height)",
        minHeight: 52,
        background: "rgba(248,249,252,.96)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              "relative inline-flex h-[52px] items-center whitespace-nowrap text-[14px] font-semibold outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-m-primary/40",
              isActive
                ? "text-m-primary"
                : "text-m-text-muted hover:text-[#344054]",
            ].join(" ")}
            style={{ background: "transparent", border: 0 }}
          >
            {tab.label}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px rounded-t-sm bg-m-primary"
                style={{ height: "2.5px" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Summary strip — the "understand the entity in 3 seconds" row of small,
 * uniform metric cards that sits directly under the tabs.
 * ------------------------------------------------------------------ */

export function SummaryGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{children}</div>
  );
}

export function SummaryCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon?: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "error" | "info" | "neutral";
}) {
  const iconBg: Record<string, string> = {
    default: "bg-m-surface-3",
    primary: "bg-m-primary-50",
    success: "bg-m-success-light",
    warning: "bg-m-warning-light",
    error: "bg-m-error-light",
    info: "bg-m-info-light",
    neutral: "bg-m-surface-3",
  };
  const iconFg: Record<string, string> = {
    default: "text-m-text-muted",
    primary: "text-m-primary",
    success: "text-m-success",
    warning: "text-m-warning-dark",
    error: "text-m-error",
    info: "text-m-info-dark",
    neutral: "text-m-text",
  };
  return (
    <div className="flex flex-col gap-2 rounded-m-xl border border-m-border bg-m-surface p-4 shadow-m-xs">
      <div className="flex items-center gap-2">
        {icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-m-md ${iconBg[tone]}`}>
            <Icon name={icon} size={14} className={iconFg[tone]} />
          </span>
        )}
        <span className="text-[11px] font-medium uppercase tracking-wide text-m-text-muted">
          {label}
        </span>
      </div>
      <div className="truncate text-[15px] font-semibold leading-tight text-m-text">{value}</div>
      {sub != null && sub !== "" && (
        <div className="truncate text-[12px] leading-tight text-m-text-muted">{sub}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Content grid — responsive 12-col. main = 8, side = 4 (spec default).
 * Columns stack on < xl so tablets don't get a squeezed context rail.
 * ------------------------------------------------------------------ */

export function ContentGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">{children}</div>;
}

export function MainColumn({ span = 8, children }: { span?: 6 | 7 | 8; children: ReactNode }) {
  const cls = span === 6 ? "lg:col-span-6" : span === 7 ? "lg:col-span-7" : "lg:col-span-8";
  return <div className={`flex flex-col gap-5 ${cls}`}>{children}</div>;
}

export function SideColumn({ span = 4, children }: { span?: 4 | 5 | 6; children: ReactNode }) {
  const cls = span === 6 ? "lg:col-span-6" : span === 5 ? "lg:col-span-5" : "lg:col-span-4";
  return <div className={`flex flex-col gap-5 ${cls}`}>{children}</div>;
}

/* ------------------------------------------------------------------ *
 * Section card — the quiet, bordered content panel with an icon + title
 * header and an optional right-aligned action (e.g. "Edit", "View all").
 * `tone="amber"` is reserved for Quick Actions surfaces.
 * ------------------------------------------------------------------ */

export function SectionCard({
  title,
  icon,
  action,
  tone = "default",
  bodyClassName,
  className,
  children,
}: {
  title?: ReactNode;
  icon?: string;
  action?: ReactNode;
  tone?: "default" | "amber";
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const amber = tone === "amber";
  return (
    <section
      className={[
        "overflow-hidden rounded-m-xl border",
        amber ? "border-m-warning-border bg-m-warning-light" : "border-m-border bg-m-surface",
        className ?? "",
      ].join(" ")}
      style={{ boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}
    >
      {title != null && (
        <header
          className={[
            "flex items-center justify-between gap-3 px-5 py-3.5",
            amber ? "" : "border-b border-m-border/60",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-2">
            {icon && (
              <Icon
                name={icon}
                size={16}
                className={amber ? "text-m-warning-dark" : "text-m-text-muted"}
              />
            )}
            <h3 className="truncate text-[15px] font-semibold text-m-text">{title}</h3>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClassName ?? "px-5 py-4"}>{children}</div>
    </section>
  );
}

/** Small blue text/ghost action for card headers ("Edit", "View all →"). */
export function CardAction({
  onClick,
  href,
  children,
}: {
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "inline-flex items-center gap-1 text-[12px] font-semibold text-m-primary transition-colors hover:text-m-primary-600";
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Info list — label/value pairs inside a card. `mono` for IDs.
 * `emptyValue` renders the honest "—" when a real field is genuinely absent
 * (never a fabricated placeholder — see the project no-mock rule).
 * ------------------------------------------------------------------ */

export function InfoList({
  columns = 1,
  children,
}: {
  columns?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <dl className={columns === 2 ? "grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2" : "flex flex-col gap-3"}>
      {children}
    </dl>
  );
}

export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}) {
  const empty = value == null || value === "" || value === "--";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] font-medium text-m-text-muted">{label}</dt>
      <dd
        className={[
          "text-[13.5px] leading-snug",
          empty ? "text-m-text-subtle" : "text-m-text",
          mono ? "font-mono text-[12.5px]" : "font-medium",
        ].join(" ")}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Status badge — one place that maps a domain status string to a colour, so
 * "Open / Paid / Delivered / Pending / Failed" read the same on every screen.
 * ------------------------------------------------------------------ */

export type StatusTone = "info" | "success" | "warning" | "error" | "neutral" | "primary";

export function StatusPill({
  tone = "neutral",
  dot = true,
  children,
}: {
  tone?: StatusTone;
  dot?: boolean;
  children: ReactNode;
}) {
  const map: Record<StatusTone, string> = {
    info: "bg-m-info-light text-m-info-dark",
    primary: "bg-m-primary-50 text-m-primary",
    success: "bg-m-success-light text-m-success",
    warning: "bg-m-warning-light text-m-warning-dark",
    error: "bg-m-error-light text-m-error",
    neutral: "bg-m-surface-3 text-m-text",
  };
  const dotMap: Record<StatusTone, string> = {
    info: "bg-m-info",
    primary: "bg-m-primary",
    success: "bg-m-success",
    warning: "bg-m-warning",
    error: "bg-m-error",
    neutral: "bg-m-neutral-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-m-full text-[12px] font-semibold ${map[tone]}`}
      style={{ padding: "3px 8px" }}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotMap[tone]}`} aria-hidden />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Operational timeline — one component for shipping / returns / recovery /
 * refund-approval / activity. States carry meaning by icon AND colour
 * (accessibility: never colour alone).
 * ------------------------------------------------------------------ */

export type TimelineState = "complete" | "current" | "waiting" | "exception";

export interface TimelineItem {
  label: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  state: TimelineState;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const node: Record<TimelineState, { ring: string; icon: string; iconColor: string }> = {
    complete: { ring: "border-m-success bg-m-success", icon: "check", iconColor: "text-white" },
    current: { ring: "border-m-primary bg-m-primary", icon: "loader", iconColor: "text-white" },
    waiting: { ring: "border-m-border bg-m-surface", icon: "circle", iconColor: "text-m-text-subtle" },
    exception: { ring: "border-m-warning bg-m-warning-light", icon: "alert-triangle", iconColor: "text-m-warning-dark" },
  };
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const n = node[item.state];
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[11px] top-7 h-[calc(100%-16px)] w-px bg-m-border"
              />
            )}
            <span
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${n.ring}`}
            >
              <Icon name={n.icon} size={12} className={n.iconColor} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[13px] font-semibold text-m-text">{item.label}</span>
                {item.meta && <span className="text-[12px] text-m-text-muted">{item.meta}</span>}
              </div>
              {item.detail && (
                <div className="mt-0.5 text-[12px] text-m-text-muted">{item.detail}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ *
 * Quick actions — the pale-amber "these controls change something" surface.
 * ------------------------------------------------------------------ */

export function QuickActions({
  title = "Quick Actions",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} icon="zap" tone="amber" bodyClassName="p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </SectionCard>
  );
}

export function QuickAction({
  icon,
  label,
  onClick,
  tone = "default",
  disabled = false,
}: {
  icon: string;
  label: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex items-center gap-2 rounded-m-lg border bg-m-surface px-3 py-2.5 text-[13px] font-semibold transition-colors",
        "border-m-border hover:border-m-border-strong hover:bg-m-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" ? "text-m-error" : "text-m-text",
      ].join(" ")}
    >
      <Icon name={icon} size={16} className={tone === "danger" ? "text-m-error" : "text-m-primary"} />
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons — one primary per decision area (spec). Thin wrappers so every
 * detail page's header actions look identical.
 * ------------------------------------------------------------------ */

export function PrimaryButton({
  icon,
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  icon?: string;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-m-md bg-m-primary px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-m-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  icon,
  trailingIcon,
  children,
  onClick,
  disabled = false,
}: {
  icon?: string;
  trailingIcon?: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-m-md border border-m-border bg-m-surface px-3.5 text-[13.5px] font-semibold text-m-text transition-colors hover:bg-m-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={15} className="text-m-text-muted" />}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * More actions menu — the standard "More actions ▾" header control. Renders
 * a real dropdown of a page's secondary actions (never a dead button): pass
 * only actions backed by real handlers. Renders nothing when there are none,
 * so a page with no real secondary action doesn't show an empty control.
 * ------------------------------------------------------------------ */

export interface MoreAction {
  id: string;
  label: ReactNode;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MoreActionsMenu({
  actions,
  label = "More actions",
}: {
  actions: (MoreAction | "divider")[];
  label?: string;
}) {
  const hasReal = actions.some((a) => a !== "divider");
  if (!hasReal) return null;
  return (
    <Dropdown
      align="right"
      trigger={
        <span className="inline-flex h-10 cursor-pointer select-none items-center gap-2 rounded-m-md border border-m-border bg-m-surface px-3.5 text-[13.5px] font-semibold text-m-text transition-colors hover:bg-m-surface-2">
          {label}
          <Icon name="chevron-down" size={15} className="text-m-text-muted" />
        </span>
      }
      items={actions.map((a) =>
        a === "divider"
          ? "divider"
          : { id: a.id, label: a.label, icon: a.icon, danger: a.danger, disabled: a.disabled, onClick: a.onClick },
      )}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Honest empty / unavailable states. Distinguishes "backend returned nothing"
 * from "field genuinely absent" — never a fabricated value (no-mock rule).
 * ------------------------------------------------------------------ */

export function CardEmpty({
  icon = "inbox",
  title,
  hint,
}: {
  icon?: string;
  title: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
      <Icon name={icon} size={22} className="text-m-text-subtle" />
      <p className="text-[13px] font-medium text-m-text">{title}</p>
      {hint && <p className="max-w-xs text-[12px] text-m-text-muted">{hint}</p>}
    </div>
  );
}
