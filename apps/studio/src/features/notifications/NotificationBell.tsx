"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Ticket, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useDialogAccessibility } from "@csa/ui";
import { localizePathname } from "@/i18n/routing";
import type { AppLocale } from "@csa/i18n";

type Notification = { id: string; ticketId: string; ticketNumber: string; title: string; subject: string; createdAt: string; read: boolean };
type Feed = { items: Notification[]; unreadCount: number; asOf: string };
const query = `query Notifications($clientId: ID!, $projectKey: String!) { ticketNotifications(clientId: $clientId, projectKey: $projectKey) { asOf unreadCount items { id ticketId ticketNumber title subject createdAt read } } }`;
async function graphql<T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/graphql", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ query, variables }), signal });
  const result = await response.json();
  if (!response.ok || result.errors?.length || !result.data) throw new Error("Notifications are unavailable. Try refreshing.");
  return result.data;
}

/** Remounted by the shell when user/client/project changes, clearing the old feed. */
export function NotificationBell({ locale, clientId, projectKey }: { locale: AppLocale; clientId: string; projectKey: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const close = useCallback(() => setOpen(false), []);
  const dialog = useDialogAccessibility<HTMLDivElement>({ isOpen: open, onClose: close });
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++generation.current;
    try {
      const result = await graphql<{ ticketNotifications: Feed }>(query, { clientId, projectKey }, signal);
      if (mounted.current && current === generation.current) { setFeed(result.ticketNotifications); setError(""); }
    } catch {
      if (mounted.current && !signal?.aborted && current === generation.current) setError("Notifications are unavailable. Try refreshing.");
    }
  }, [clientId, projectKey]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(controller.signal); }, 15000);
    const onFocus = () => { void refresh(controller.signal); };
    window.addEventListener("focus", onFocus);
    return () => { mounted.current = false; controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  async function markRead(item?: Notification) {
    if (!feed || busy) return;
    setBusy(true);
    ++generation.current;
    try {
      await graphql(item ? `mutation ReadNotification($id: ID!, $clientId: ID!, $projectKey: String!) { markTicketNotificationRead(id: $id, clientId: $clientId, projectKey: $projectKey) }` : `mutation ReadNotifications($through: String!, $clientId: ID!, $projectKey: String!) { markAllTicketNotificationsRead(through: $through, clientId: $clientId, projectKey: $projectKey) }`, { clientId, projectKey, ...(item ? { id: item.id } : { through: feed.asOf }) });
      if (!mounted.current) return;
      await refresh();
      if (item) { setOpen(false); router.push(localizePathname(`/tickets/${encodeURIComponent(item.ticketId)}`, locale)); }
    } catch { if (mounted.current) setError("Could not mark notifications as read. Please try again."); }
    finally { if (mounted.current) setBusy(false); }
  }
  const count = feed?.unreadCount ?? 0;
  return (
    <>
      <button type="button" aria-label={error ? "Notifications unavailable" : `Notifications${count ? `, ${count} unread` : ""}`} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { setOpen(true); void refresh(); }}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
        style={{ color: "var(--topbar-text)" }}>
        <Bell size={22} aria-hidden />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white" aria-hidden>{count > 99 ? "99+" : count}</span>}
        {error && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-600" aria-hidden />}
      </button>
      {open && createPortal(<div className="fixed inset-0 z-[100] bg-slate-950/25" onClick={close}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="notifications-title" tabIndex={-1} onClick={event => event.stopPropagation()}
          className="absolute right-3 top-20 flex max-h-[calc(100dvh-6rem)] w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <h2 id="notifications-title" className="flex-1 text-lg font-semibold">Notifications</h2>
            <button type="button" disabled={busy || !count} onClick={() => void markRead()} className="flex items-center gap-1 text-xs font-medium text-blue-600 disabled:opacity-40"><CheckCheck size={16} aria-hidden />Mark all as read</button>
            <button type="button" aria-label="Close notifications" onClick={close} className="rounded-lg p-1.5 hover:bg-slate-100"><X size={20} /></button>
          </div>
          <p className="px-5 py-2 text-xs text-slate-500">Your assigned tickets and the project queue · updates every 15 seconds</p>
          {error && <div role="alert" className="mx-4 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={() => void refresh()} className="underline">Refresh</button></div>}
          <div className="overflow-y-auto p-3">
            {!feed && !error && <p role="status" className="p-8 text-center text-sm text-slate-500">Loading notifications…</p>}
            {feed?.items.length === 0 && <div className="px-6 py-12 text-center"><Bell className="mx-auto mb-3 text-slate-300" size={32} /><p className="font-medium">You’re all caught up</p><p className="mt-1 text-sm text-slate-500">New tickets and updates will appear here.</p></div>}
            <ul className="space-y-2">{feed?.items.map(item => <li key={item.id}>
              <button type="button" disabled={busy} onClick={() => void markRead(item)} className={`flex w-full gap-3 rounded-xl border p-4 text-left transition hover:border-blue-300 disabled:opacity-60 ${item.read ? "border-slate-200 bg-white" : "border-blue-100 bg-blue-50"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600"><Ticket size={20} aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold">{item.title}{!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}</span><span className="mt-1 block text-xs font-medium text-blue-700">{item.ticketNumber}</span><span className="mt-1 block break-words text-sm text-slate-600">{item.subject}</span><time dateTime={item.createdAt} className="mt-2 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></span>
              </button>
            </li>)}</ul>
          </div>
          {!!feed?.items.length && <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Latest 50 notifications · {count} unread</p>}
        </div>
      </div>, document.body)}
    </>
  );
}
