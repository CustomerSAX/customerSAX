"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversationStore } from "../store/conversation-store";
import { useCurrentUser } from "@/lib/use-current-user";
import { formatDate } from "@/lib/format-date";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTicket {
  id: string;
  ticketNumber?: string;
  subject?: string;
  status?: string;
  priority?: string;
  customerName?: string;
  customerEmail?: string;
  customerId?: string;
  lastModifiedAt?: string;
  createdAt?: string;
}

interface CustomerRow {
  customerEmail: string;
  customerName?: string;
  openCount: number;
  lastActivity: string;
  issuePreview: string;
  activeTicket: RawTicket;
  openTickets: RawTicket[];
}

type FilterTab = "assigned_to_me" | "open" | "closed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return "Yesterday";
    if (diffD < 7) return `${diffD}d ago`;
    return formatDate(iso);
  } catch { return ""; }
}

// A 5-way hash palette for customer-initial avatars — needs more distinct hues
// than the semantic status tokens provide (same reasoning as the CSA Assistant
// quick-actions row), so two entries without a matching semantic token
// (pink, violet) intentionally stay as literal Tailwind-style hex.
const AVATAR_COLORS = [
  { bg: "var(--color-primary-light)", color: "var(--color-primary)", border: "var(--color-primary-border)" },
  { bg: "var(--color-success-bg)", color: "var(--color-success)", border: "var(--color-success)" },
  { bg: "#fce7f3", color: "#9d174d", border: "#fbcfe8" },
  { bg: "var(--color-warning-bg)", color: "var(--color-warning)", border: "var(--color-warning)" },
  { bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe" },
];

function avatarColor(name?: string) {
  const idx = ((name ?? "").charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

const OPEN_STATUSES = new Set(["open", "new", "pending", "in_progress", ""]);
const CLOSED_STATUSES = new Set(["closed", "resolved", "done"]);

function getSessionStatus(status?: string) {
  const s = (status ?? "").toLowerCase();
  if (CLOSED_STATUSES.has(s)) return { label: "Resolved", bg: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "var(--color-border)" };
  if (s === "new") return { label: "New", bg: "var(--color-primary-light)", color: "var(--color-primary)", border: "var(--color-primary-border)" };
  if (s === "in_progress") return { label: "In Progress", bg: "var(--color-warning-bg)", color: "var(--color-warning)", border: "var(--color-warning)" };
  return { label: "Open", bg: "var(--color-success-bg)", color: "var(--color-success)", border: "var(--color-success)" };
}

function groupByCustomer(tickets: RawTicket[]): CustomerRow[] {
  const map = new Map<string, RawTicket[]>();
  for (const t of tickets) {
    const key = t.customerEmail ?? t.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  return [...map.entries()].map(([, group]) => {
    const sorted = [...group].sort(
      (a, b) =>
        new Date(b.lastModifiedAt ?? b.createdAt ?? 0).getTime() -
        new Date(a.lastModifiedAt ?? a.createdAt ?? 0).getTime()
    );
    const openTickets = sorted.filter((t) => OPEN_STATUSES.has((t.status ?? "").toLowerCase()));
    const activeTicket = openTickets[0] ?? sorted[0];
    return {
      customerEmail: activeTicket.customerEmail ?? "",
      customerName: activeTicket.customerName,
      openCount: openTickets.length,
      lastActivity: activeTicket.lastModifiedAt ?? activeTicket.createdAt ?? "",
      issuePreview: (activeTicket.subject ?? "").trim(),
      activeTicket,
      openTickets,
    };
  }).sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationList() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("assigned_to_me");
  const [activeEmail, setActiveEmail] = useState<string | null>(null);

  // Logged-in agent identity — needed to filter "Assigned to Me" correctly.
  const { user } = useCurrentUser();
  // Stable ref so fetchTickets (useCallback with [] deps) can always read the
  // latest email without being recreated every time useCurrentUser resolves.
  const userEmailRef = useRef<string | undefined>(undefined);
  useEffect(() => { userEmailRef.current = user?.email; }, [user]);

  const setActiveTicketId = useConversationStore((s) => s.setActiveTicketId);
  const setContextHydrated = useConversationStore((s) => s.setContextHydrated);
  const setRightPanelOpen = useConversationStore((s) => s.setRightPanelOpen);
  const resetTicketContext = useConversationStore((s) => s.resetTicketContext);
  const startNewConversation = useConversationStore((s) => s.startNewConversation);
  const activeTicketId = useConversationStore((s) => s.activeTicketId);

  // pending briefing to auto-send when user selects a ticket
  const [pendingBriefing, setPendingBriefing] = useState<{
    ticketId: string;
    contextLines: string;
  } | null>(null);
  // expose so ChatStream can consume it
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__csaPendingBriefing = pendingBriefing;
      (window as unknown as Record<string, unknown>).__csaClearBriefing = () => setPendingBriefing(null);
    }
  }, [pendingBriefing]);

  const fetchTickets = useCallback(async (tab: FilterTab) => {
    setLoading(true);
    setError(null);
    try {
      // For the "Assigned to Me" tab, pass the logged-in agent's email as the
      // assignee filter so the backend only returns their tickets, not all open ones.
      let url = `/api/tickets?status=${tab}&limit=100`;
      if (tab === "assigned_to_me" && userEmailRef.current) {
        url += `&assignee=${encodeURIComponent(userEmailRef.current)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: RawTicket[]; total: number };
      const allTickets = data.results ?? [];

      const filtered =
        tab === "closed"
          ? allTickets.filter((t) => CLOSED_STATUSES.has((t.status ?? "").toLowerCase()))
          : allTickets.filter((t) => OPEN_STATUSES.has((t.status ?? "").toLowerCase()));

      setCustomers(groupByCustomer(filtered));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchTickets(filter);
    });
  }, [filter, fetchTickets]);

  // Re-fetch "Assigned to Me" once the user email resolves — the initial fetch
  // fires before useCurrentUser completes, so the first call has no email and
  // would return all-open instead of just the agent's tickets.
  const prevEmailRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!user?.email || user.email === prevEmailRef.current) return;
    prevEmailRef.current = user.email;
    if (filter === "assigned_to_me") {
      queueMicrotask(() => {
        void fetchTickets("assigned_to_me");
      });
    }
  }, [user?.email, filter, fetchTickets]);

  const handleSelectCustomer = useCallback(
    (row: CustomerRow, specificTicket?: RawTicket) => {
      const ticket = specificTicket ?? row.activeTicket;
      // IMPORTANT: reset FIRST, then set the new active ticket. resetTicketContext
      // sets activeTicketId back to null — calling it after setActiveTicketId (as
      // this used to do) silently clobbered the id back to null in the same tick,
      // so from React's perspective activeTicketId never actually changed and the
      // effect that auto-sends the case-briefing (keyed on activeTicketId) never
      // fired. No chat message was ever sent and AI Analysis never populated.
      resetTicketContext();
      setActiveEmail(row.customerEmail);
      setActiveTicketId(ticket.id);
      setRightPanelOpen(true);

      // Prefill the store so the right panel shows immediately
      const isRealEmail = row.customerEmail.includes("@");
      const interimName = row.customerName ?? (isRealEmail ? row.customerEmail : "Unknown Customer");

      setContextHydrated("Customer", {
        id: row.customerEmail,
        name: interimName,
        email: isRealEmail ? row.customerEmail : undefined,
        status: "Active",
      });

      // Deterministically resolve the real customer profile (member-since,
      // order count, lifetime value) in the background — the interim prefill
      // above has no way to know these, so Since/Orders/Spent stayed blank
      // forever without this. Guard against a stale response landing after
      // the agent has already switched to a different ticket.
      if (isRealEmail) {
        fetch(`/api/context/resolve?email=${encodeURIComponent(row.customerEmail)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            const resolved = data?.customer;
            if (!resolved) return;
            if (useConversationStore.getState().activeTicketId !== ticket.id) return;
            setContextHydrated("Customer", {
              id: resolved.id ?? row.customerEmail,
              name: resolved.name || interimName,
              email: resolved.email || row.customerEmail,
              status: resolved.tier || "Active",
              createdAt: resolved.createdAt ?? undefined,
              orderCount: resolved.orderCount ?? undefined,
              lifetimeValue: resolved.lifetimeValue ?? undefined,
            });
          })
          .catch((e) => console.error("Failed to resolve customer context:", e));
      }

      setContextHydrated("Ticket", {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber ?? ticket.id,
        subject: ticket.subject,
        status: ticket.status,
      } as unknown as Record<string, unknown>);

      // Build briefing context
      const description = (ticket.subject ?? "").trim();
      const contextLines = [
        `Customer email: ${row.customerEmail}`,
        row.customerName ? `Customer name: ${row.customerName}` : null,
        `Ticket: ${ticket.ticketNumber ? `#${ticket.ticketNumber}` : ticket.id}`,
        ticket.subject ? `Subject: ${ticket.subject}` : null,
        description ? `Description: ${description}` : null,
      ].filter(Boolean).join("\n");

      setPendingBriefing({ ticketId: ticket.id, contextLines });
    },
    [setActiveTicketId, setContextHydrated, setRightPanelOpen, resetTicketContext]
  );

  const storeRef = useRef({ setActiveTicketId, resetTicketContext, setRightPanelOpen });
  useEffect(() => {
    storeRef.current = { setActiveTicketId, resetTicketContext, setRightPanelOpen };
  });

  const openCount = customers.filter((c) => c.openCount > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-surface-1)" }}>

      {/* ── Brand header ── */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid var(--color-border)",
        background: "linear-gradient(135deg, var(--csa-blue-500) 0%, var(--csa-blue-700) 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 1 C10.8 5.5 12.5 7.5 18 10 C12.5 12.5 10.8 14.5 10 19 C9.2 14.5 7.5 12.5 2 10 C7.5 7.5 9.2 5.5 10 1 Z" fill="var(--color-text-inverse)" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-inverse)", lineHeight: 1 }}>CSA Assistant</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>AI Copilot for Support</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)" }} title="Online" />
            <button
              onClick={() => void fetchTickets(filter)}
              title="Refresh"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(255,255,255,0.7)", display: "flex" }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setActiveEmail(null);
            setActiveTicketId(null);
            resetTicketContext();
            startNewConversation();
          }}
          style={{
            width: "100%", padding: "8px 12px",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 8, color: "var(--color-text-inverse)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Conversation
        </button>
      </div>

      {/* ── Filter tabs ── */}
      <div style={{ display: "flex", gap: 2, padding: "8px 12px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
        {(["assigned_to_me", "open", "closed"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              flex: 1, padding: "5px 4px",
              border: "none", borderRadius: 6,
              background: filter === tab ? "var(--color-primary)" : "transparent",
              color: filter === tab ? "var(--color-text-inverse)" : "var(--color-text-muted)",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            {tab === "assigned_to_me" ? "Assigned to Me" : tab === "open" ? "Open" : "Closed"}
            {tab === "open" && filter === "open" && openCount > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, background: "rgba(255,255,255,0.3)",
                borderRadius: "9999px", padding: "1px 5px", lineHeight: 1,
              }}>{openCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div className="flex flex-col gap-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-3 p-4 border-b border-m-border animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-m-surface-hover"></div>
                  <div className="flex flex-col flex-1 gap-2">
                    <div className="h-3.5 w-3/4 rounded bg-m-surface-hover"></div>
                    <div className="h-2.5 w-1/2 rounded bg-m-surface-hover"></div>
                  </div>
                </div>
                <div className="h-14 w-full rounded-m-sm bg-m-surface-hover"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: 16, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--color-error)", marginBottom: 8 }}>Failed to load tickets</p>
            <button onClick={() => void fetchTickets(filter)} style={{ fontSize: 11, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
          </div>
        ) : customers.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "40px 16px", color: "var(--color-text-subtle)" }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p style={{ fontSize: 12, margin: 0 }}>No {filter === "closed" ? "resolved" : "active"} tickets</p>
          </div>
        ) : (
          customers.map((row) => {
            const isRealEmail = row.customerEmail.includes("@");
            const displayName = row.customerName ?? (isRealEmail ? row.customerEmail : "Unknown Customer");
            const col = avatarColor(displayName);
            const initials = getInitials(displayName);
            const isActive = activeEmail === row.customerEmail;
            const sessionStatus = getSessionStatus(row.activeTicket.status);

            return (
              <div
                key={row.customerEmail}
                onClick={() => handleSelectCustomer(row)}
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--color-border)",
                  background: isActive ? "var(--color-primary-light)" : "var(--color-surface-1)",
                  cursor: "pointer",
                  borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-2)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-1)"; }}
              >
                {/* Name + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    backgroundColor: col.bg, color: col.color, border: `1px solid ${col.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "70%" }}>
                        {displayName}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--color-text-subtle)", flexShrink: 0 }}>
                        {formatRelativeTime(row.lastActivity)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Issue preview */}
                <div style={{
                  fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4,
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  marginBottom: 6,
                }}>
                  {row.issuePreview
                    ? row.issuePreview.slice(0, 80) + (row.issuePreview.length > 80 ? "…" : "")
                    : `Ticket #${row.activeTicket.ticketNumber ?? row.activeTicket.id.slice(-6)}`}
                </div>

                {/* Status / open count badges */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {row.openCount > 1 ? (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: "var(--color-primary)",
                      backgroundColor: "var(--color-primary-light)", border: "1px solid var(--color-primary-border)",
                      padding: "1px 7px", borderRadius: "9999px",
                    }}>
                      {row.openCount} open tickets
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: sessionStatus.color, backgroundColor: sessionStatus.bg,
                      border: `1px solid ${sessionStatus.border}`,
                      padding: "1px 7px", borderRadius: "9999px",
                    }}>
                      {sessionStatus.label}
                    </span>
                  )}
                </div>

                {/* Nested ticket list when multiple open */}
                {row.openCount > 1 && row.openTickets.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                    {row.openTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={(e) => { e.stopPropagation(); handleSelectCustomer(row, t); }}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: activeTicketId === t.id ? "var(--color-primary-light)" : "var(--color-surface-2)",
                          border: `1px solid ${activeTicketId === t.id ? "var(--color-primary-border)" : "var(--color-border)"}`,
                          borderRadius: 4, fontSize: 11,
                          color: activeTicketId === t.id ? "var(--color-primary)" : "var(--color-ink-soft)",
                          cursor: "pointer", display: "flex", flexDirection: "column", gap: 2,
                        }}
                      >
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.subject ?? `Ticket #${t.ticketNumber ?? t.id.slice(-6)}`}
                        </div>
                        <div style={{ fontSize: 9, color: activeTicketId === t.id ? "var(--color-primary)" : "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                          {t.status ?? "Open"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
