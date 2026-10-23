"use client";

import { useEffect, useState } from "react";
import { Icon } from "@csa/ui";
import { useNotificationStore, type AppNotification, type NotificationVariant } from "./notification-store";

const STYLE: Record<NotificationVariant, { icon: string; iconClass: string; edge: string }> = {
  success: { icon: "check-circle", iconClass: "text-m-success", edge: "border-l-m-success" },
  error: { icon: "alert-circle", iconClass: "text-m-error", edge: "border-l-m-error" },
  warning: { icon: "alert-triangle", iconClass: "text-m-warning", edge: "border-l-m-warning" },
  info: { icon: "info", iconClass: "text-m-info", edge: "border-l-m-info" }
};

const TOAST_MS = 6000;

/** One pop-up: slides in, auto-hides after a few seconds (paused while hovered); errors stay until closed. */
function ToastItem({ n, dismiss }: { n: AppNotification; dismiss: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const style = STYLE[n.variant];
  const onClose = () => dismiss(n.id);

  useEffect(() => {
    if (n.variant === "error" || hovered) return;
    const timer = setTimeout(() => dismiss(n.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [n.id, n.variant, hovered, dismiss]);

  return (
    <div
      role={n.variant === "error" ? "alert" : "status"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`pointer-events-auto flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-m-xl border border-m-border border-l-4 ${style.edge} bg-m-surface p-4 shadow-m-panel animate-in slide-in-from-right-8 fade-in duration-300`}
    >
      <Icon name={style.icon as "info"} size="md" className={`mt-0.5 shrink-0 ${style.iconClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-m-text">{n.title}</p>
        {n.description && <p className="mt-0.5 text-xs leading-relaxed text-m-text-muted">{n.description}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-m-md p-1 text-m-text-muted transition-colors hover:bg-m-surface-2 hover:text-m-text"
        aria-label="Dismiss notification"
      >
        <Icon name="x" size="xs" />
      </button>
    </div>
  );
}

/**
 * Pop-up confirmations for actions done in this session (order cancelled,
 * follow-up moved, …), top-right below the top bar. Saved ticket
 * notifications live in NotificationBell (served by the ticketing service).
 */
export function NotificationToaster() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const toasts = notifications.filter((n) => n.toast).slice(0, 4);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-6 top-[84px] z-[1000] flex flex-col gap-2" aria-live="polite">
      {toasts.map((n) => (
        <ToastItem key={n.id} n={n} dismiss={dismissToast} />
      ))}
    </div>
  );
}
