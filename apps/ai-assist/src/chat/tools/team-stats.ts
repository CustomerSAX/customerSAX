/**
 * Team-lead stats — "returns this week by reason", "who's been waiting more
 * than 24h", "ticket workload", "orders this week".
 *
 * Read-only. Every number is counted from real records fetched through the
 * BFF (commercetools orders, the ticketing provider's tickets). Neither backend
 * offers aggregation, so records are paged in (100 per page, capped) and
 * counted here; when the cap is hit the result says so in `note` rather than
 * presenting a partial count as the whole truth. The studio renders the result
 * as a stats card with clickable rows.
 */

import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { bffQuery, formatMoney } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";
import { instrumentTools } from "./instrument.js";
import { RESOLUTION_REASONS } from "./ui-tools.js";

const log = createLogger("ai-assist").child({ module: "tools/team-stats" });

const PAGE = 100;
const MAX_ORDER_PAGES = 10; // up to 1,000 orders scanned
const MAX_TICKET_PAGES = 10; // up to 1,000 tickets

type Money = { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null | undefined;

type StatOrder = {
  id: string;
  orderNumber?: string | null;
  createdAt: string;
  lastModifiedAt?: string | null;
  orderState?: string | null;
  state?: string | null;
  shipmentState?: string | null;
  paymentState?: string | null;
  customerEmail?: string | null;
  totalPrice?: Money;
  lineItems?: Array<{ id: string; name: string; quantity: number }>;
  returnInfo?: Array<{
    returnDate?: string | null;
    items?: Array<{ lineItemId?: string | null; quantity: number; comment?: string | null }>;
  }> | null;
};

type StatTicket = {
  id: string;
  ticketNumber: string;
  customerName?: string | null;
  customerEmail?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  subject: string;
  assignee?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
};

type Row = { label: string; value: number; display?: string };
type ItemRow = { cells: string[]; prompt?: string };

/** The one shape the studio's stats card renders. */
export type TeamStats = {
  found: true;
  metric: string;
  title: string;
  subtitle: string;
  kpis: Array<{ label: string; value: string }>;
  groups: Array<{ title: string; rows: Row[] }>;
  items: { title: string; columns: string[]; rows: ItemRow[] } | null;
  /** Further clickable lists, shown under `items`. */
  moreItems?: Array<{ title: string; columns: string[]; rows: ItemRow[] }>;
  note: string | null;
  displayed: string;
};

const DISPLAYED =
  "These numbers are now shown to the rep as a stats card (headline figures, bar breakdowns and a clickable list). " +
  "Do NOT restate the numbers, rows or list as text or bullets. Reply with ONE short line giving the single most useful takeaway.";

const day = (iso: string) => iso.slice(0, 10);
/** Providers mix cases ("Urgent", "high") — one bar per priority. */
const label = (v: string | null | undefined) => (v?.trim() ? v.trim()[0].toUpperCase() + v.trim().slice(1).toLowerCase() : "None");
const hoursSince = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null);
const ageText = (hours: number) => (hours >= 48 ? `${Math.floor(hours / 24)}d` : `${Math.floor(hours)}h`);

function countBy<T>(list: T[], key: (t: T) => string, weight: (t: T) => number = () => 1): Row[] {
  const map = new Map<string, number>();
  for (const item of list) map.set(key(item), (map.get(key(item)) ?? 0) + weight(item));
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** start_return stores "<reason id or label> — <note>" as each return item's comment. */
function reasonLabel(comment: string | null | undefined): string {
  const raw = (comment ?? "").split(" — ")[0].trim();
  if (!raw) return "No reason recorded";
  return RESOLUTION_REASONS.find((r) => r.id === raw)?.label ?? (raw.length <= 60 ? raw : `${raw.slice(0, 57)}...`);
}

/** Orders newest-first by `sortKey`, stopping once they fall before `since`. */
async function scanOrders(sortKey: "createdAt" | "lastModifiedAt", since: Date) {
  const orders: StatOrder[] = [];
  let capped = false;
  for (let pageNo = 0; pageNo < MAX_ORDER_PAGES; pageNo++) {
    const data = await bffQuery<{ orderPage: { results: StatOrder[]; total: number } }>(
      `query StatOrders($limit: Int, $offset: Int, $sortKey: String) {
        orderPage(limit: $limit, offset: $offset, sortKey: $sortKey, sortOrder: "desc") {
          total
          results {
            id orderNumber createdAt lastModifiedAt orderState state shipmentState paymentState customerEmail
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id name quantity }
            returnInfo { returnDate items { lineItemId quantity comment } }
          }
        }
      }`,
      { limit: PAGE, offset: pageNo * PAGE, sortKey }
    );
    const results = data.orderPage?.results ?? [];
    orders.push(...results);
    const oldest = results.at(-1);
    const oldestAt = oldest ? (sortKey === "createdAt" ? oldest.createdAt : oldest.lastModifiedAt ?? oldest.createdAt) : null;
    if (results.length < PAGE || !oldestAt || new Date(oldestAt) < since) return { orders, capped };
    if (pageNo === MAX_ORDER_PAGES - 1) capped = true;
  }
  return { orders, capped };
}

/** Every ticket (any status), newest activity first; optionally only one assignee's. */
async function scanTickets(assignee?: string) {
  const tickets: StatTicket[] = [];
  let capped = false;
  for (let pageNo = 0; pageNo < MAX_TICKET_PAGES; pageNo++) {
    const data = await bffQuery<{ ticketPage: { results: StatTicket[]; total: number } }>(
      `query StatTickets($assignee: String, $limit: Int, $offset: Int) {
        ticketPage(assignee: $assignee, limit: $limit, offset: $offset, sortKey: "lastModifiedAt", sortOrder: "desc") {
          total
          results { id ticketNumber customerName customerEmail status priority category subject assignee createdAt lastModifiedAt }
        }
      }`,
      { assignee, limit: PAGE, offset: pageNo * PAGE }
    );
    const results = data.ticketPage?.results ?? [];
    tickets.push(...results);
    if (results.length < PAGE) return { tickets, capped };
    if (pageNo === MAX_TICKET_PAGES - 1) capped = true;
  }
  return { tickets, capped };
}

/** Statuses that mean the team still owes the customer something. */
const CLOSED_STATUSES = new Set(["closed", "resolved", "solved", "done"]);
/** Providers name statuses differently (open / in-progress / Pending / hold / new...) — anything not closed is still owed work. */
const isActive = (t: StatTicket) => !CLOSED_STATUSES.has((t.status ?? "").trim().toLowerCase());

function periodText(days: number) {
  return days === 1 ? "last 24 hours" : `last ${days} days`;
}

async function returnsStats(days: number): Promise<TeamStats> {
  const since = new Date(Date.now() - days * 86_400_000);
  // A return updates the order, so recently modified orders hold every recent return.
  const { orders, capped } = await scanOrders("lastModifiedAt", since);
  const items = orders.flatMap((o) =>
    (o.returnInfo ?? [])
      .filter((ri) => ri.returnDate && new Date(ri.returnDate) >= since)
      .flatMap((ri) =>
        (ri.items ?? []).map((it) => ({
          orderNumber: o.orderNumber || o.id,
          date: day(ri.returnDate!),
          product: o.lineItems?.find((li) => li.id === it.lineItemId)?.name ?? "Item no longer on order",
          quantity: it.quantity,
          reason: reasonLabel(it.comment)
        }))
      )
  );
  items.sort((a, b) => b.date.localeCompare(a.date));
  const units = items.reduce((n, i) => n + i.quantity, 0);
  const ordersWithReturns = new Set(items.map((i) => i.orderNumber)).size;
  return {
    found: true,
    metric: "returns",
    title: "Returns",
    subtitle: periodText(days),
    kpis: [
      { label: "Units returned", value: String(units) },
      { label: "Orders", value: String(ordersWithReturns) },
      { label: "Return lines", value: String(items.length) }
    ],
    groups: items.length
      ? [
          { title: "By reason", rows: countBy(items, (i) => i.reason, (i) => i.quantity) },
          { title: "By product", rows: countBy(items, (i) => i.product, (i) => i.quantity).slice(0, 8) }
        ]
      : [],
    items: items.length
      ? {
          title: "Recent returns",
          columns: ["Date", "Order", "Product", "Qty", "Reason"],
          rows: items.slice(0, 15).map((i) => ({
            cells: [i.date, i.orderNumber, i.product, String(i.quantity), i.reason],
            prompt: `Show refund status for order ${i.orderNumber}`
          }))
        }
      : null,
    note: capped ? `Counted from the ${orders.length} most recently changed orders; older activity may be missing.` : null,
    displayed: DISPLAYED
  };
}

async function waitingStats(hours: number): Promise<TeamStats> {
  const scan = await scanTickets();
  const capped = scan.capped;
  const all = scan.tickets.filter(isActive);
  const waiting = all
    .map((t) => ({ t, idle: hoursSince(t.lastModifiedAt ?? t.createdAt) }))
    .filter((x): x is { t: StatTicket; idle: number } => x.idle !== null && x.idle >= hours)
    .sort((a, b) => b.idle - a.idle);
  const oldest = waiting[0];
  return {
    found: true,
    metric: "waiting_tickets",
    title: `Tickets with no update for ${hours}h+`,
    subtitle: `Not yet resolved · ${all.length} active ticket${all.length === 1 ? "" : "s"} checked`,
    kpis: [
      { label: "Waiting", value: String(waiting.length) },
      { label: "Urgent / high", value: String(waiting.filter((w) => ["urgent", "high"].includes(w.t.priority?.toLowerCase())).length) },
      { label: "Longest wait", value: oldest ? ageText(oldest.idle) : "—" }
    ],
    groups: waiting.length
      ? [
          { title: "By assignee", rows: countBy(waiting, (w) => w.t.assignee || "Unassigned") },
          { title: "By priority", rows: countBy(waiting, (w) => label(w.t.priority)) }
        ]
      : [],
    items: waiting.length
      ? {
          title: "Longest waiting first",
          columns: ["Ticket", "Customer", "Subject", "Priority", "Assignee", "No update"],
          rows: waiting.slice(0, 15).map(({ t, idle }) => ({
            cells: [`#${t.ticketNumber}`, t.customerName || t.customerEmail || "—", t.subject, t.priority, t.assignee || "Unassigned", ageText(idle)],
            prompt: `Show ticket ${t.ticketNumber}`
          }))
        }
      : null,
    note: [
      "Wait time is measured from the ticket's last update.",
      capped ? "Only the 1,000 most recently updated tickets were checked; older ones may be missing." : ""
    ].filter(Boolean).join(" "),
    displayed: DISPLAYED
  };
}

async function workloadStats(days: number): Promise<TeamStats> {
  const scan = await scanTickets();
  const capped = scan.capped;
  const active = scan.tickets.filter(isActive);
  const since = Date.now() - days * 86_400_000;
  const createdRecently = active.filter((t) => t.createdAt && new Date(t.createdAt).getTime() >= since).length;
  return {
    found: true,
    metric: "ticket_workload",
    title: "Ticket workload",
    subtitle: "All tickets not yet resolved or closed",
    kpis: [
      { label: "Active tickets", value: String(active.length) },
      { label: `Opened in ${periodText(days)}`, value: String(createdRecently) },
      { label: "Unassigned", value: String(active.filter((t) => !t.assignee).length) }
    ],
    groups: active.length
      ? [
          { title: "By assignee", rows: countBy(active, (t) => t.assignee || "Unassigned") },
          { title: "By priority", rows: countBy(active, (t) => label(t.priority)) },
          { title: "By category", rows: countBy(active, (t) => t.category || "Uncategorised").slice(0, 8) }
        ]
      : [],
    items: null,
    note: capped ? "Only the 1,000 most recently updated tickets were counted." : null,
    displayed: DISPLAYED
  };
}

async function ordersStats(days: number): Promise<TeamStats> {
  const since = new Date(Date.now() - days * 86_400_000);
  const { orders: scanned, capped } = await scanOrders("createdAt", since);
  const orders = scanned.filter((o) => new Date(o.createdAt) >= since);
  // Revenue per currency — amounts in different currencies are never added together.
  const revenue = new Map<string, { centAmount: number; fractionDigits: number }>();
  for (const o of orders) {
    const m = o.totalPrice;
    if (!m?.currencyCode || typeof m.centAmount !== "number") continue;
    const cur = revenue.get(m.currencyCode) ?? { centAmount: 0, fractionDigits: m.fractionDigits ?? 2 };
    cur.centAmount += m.centAmount;
    revenue.set(m.currencyCode, cur);
  }
  return {
    found: true,
    metric: "orders",
    title: "Orders",
    subtitle: periodText(days),
    kpis: [
      { label: "Orders placed", value: String(orders.length) },
      ...[...revenue.entries()].map(([currencyCode, v]) => ({
        label: `Revenue (${currencyCode})`,
        value: formatMoney({ centAmount: v.centAmount, currencyCode, fractionDigits: v.fractionDigits })
      })),
      { label: "Still open", value: String(orders.filter((o) => (o.orderState ?? o.state) === "Open").length) },
      { label: "Not yet shipped", value: String(orders.filter((o) => !["Shipped", "Partial", "Delivered"].includes(o.shipmentState ?? "")).length) }
    ],
    groups: orders.length
      ? [
          { title: "By day", rows: countBy(orders, (o) => day(o.createdAt)).sort((a, b) => b.label.localeCompare(a.label)) },
          { title: "By order status", rows: countBy(orders, (o) => o.orderState ?? o.state ?? "Not set") },
          { title: "By shipment status", rows: countBy(orders, (o) => o.shipmentState || "Not set") },
          { title: "By payment status", rows: countBy(orders, (o) => o.paymentState || "Not set") }
        ]
      : [],
    items: orders.length
      ? {
          title: "Latest orders",
          columns: ["Date", "Order", "Customer", "Total", "Shipment"],
          rows: orders.slice(0, 15).map((o) => ({
            cells: [day(o.createdAt), o.orderNumber || o.id, o.customerEmail || "—", o.totalPrice ? formatMoney(o.totalPrice) : "—", o.shipmentState || "Not set"],
            prompt: `Show order ${o.orderNumber || o.id}`
          }))
        }
      : null,
    note:
      [
        capped ? `Counted from the ${scanned.length} newest orders; older orders in the period may be missing.` : "",
        // An empty period is not "no orders" — say when the latest one really was.
        orders.length === 0 && scanned[0]
          ? `No orders in the ${periodText(days)}. The latest order is ${scanned[0].orderNumber || scanned[0].id}, placed ${day(scanned[0].createdAt)}.`
          : ""
      ].filter(Boolean).join(" ") || null,
    displayed: DISPLAYED
  };
}

type FollowUp = { customer: string; subject: string; due: string; overdue: boolean; email: string };

/** Open CRM tasks for these customers (by email); customers without a CRM contact are skipped. */
async function followUpsFor(emails: string[]): Promise<FollowUp[]> {
  const today = new Date().toISOString().slice(0, 10);
  const perCustomer = await Promise.all(
    emails.map(async (email) => {
      const c = await bffQuery<{ crmContactByEmail: { id: string; fullName?: string | null } | null }>(
        `query MyDayCrm($email: String!) { crmContactByEmail(email: $email) { id fullName } }`,
        { email }
      );
      const contact = c.crmContactByEmail;
      if (!contact) return [];
      const a = await bffQuery<{ crmContactActivities: Array<{ type?: string | null; subject?: string | null; completed?: boolean | null; activityDate?: string | null }> }>(
        `query MyDayCrmActs($id: ID!) { crmContactActivities(contactId: $id, limit: 20) { type subject completed activityDate } }`,
        { id: contact.id }
      );
      return (a.crmContactActivities ?? [])
        .filter((t) => t.type === "TASK" && t.completed === false)
        .map((t) => {
          const due = t.activityDate?.slice(0, 10) ?? "";
          return { customer: contact.fullName || email, subject: t.subject || "Follow-up", due, overdue: !!due && due <= today, email };
        });
    })
  );
  return perCustomer.flat().sort((x, y) => (x.due || "9999").localeCompare(y.due || "9999"));
}

async function myDayStats(): Promise<TeamStats> {
  const ctx = getSystemPromptContext();
  const me = ctx.userEmail;
  const scan = await scanTickets(me);
  const mine = scan.tickets.filter(isActive);
  const withIdle = mine
    .map((t) => ({ t, idle: hoursSince(t.lastModifiedAt ?? t.createdAt) ?? 0 }))
    .sort((a, b) => {
      const urgent = (x: StatTicket) => (/urgent/i.test(x.priority) ? 2 : /high/i.test(x.priority) ? 1 : 0);
      return urgent(b.t) - urgent(a.t) || b.idle - a.idle;
    });
  const stale = withIdle.filter((w) => w.idle >= 24);
  const urgentCount = mine.filter((t) => /urgent|high/i.test(t.priority)).length;

  // CRM follow-ups for the customers on my tickets (the CRM has no per-rep task list).
  const emails = [...new Set(mine.map((t) => t.customerEmail?.trim().toLowerCase()).filter((e): e is string => !!e))].slice(0, 10);
  let followUps: FollowUp[] = [];
  let crmNote = "";
  if (emails.length && ctx.canViewCustomers) {
    try {
      followUps = await followUpsFor(emails);
    } catch (err) {
      crmNote = /No CRM is connected/i.test(String(err)) ? "No CRM is connected, so follow-ups aren't shown." : "CRM follow-ups couldn't be loaded.";
    }
  }
  const overdue = followUps.filter((f) => f.overdue);

  return {
    found: true,
    metric: "my_day",
    title: "My day",
    subtitle: `Tickets assigned to ${me}`,
    kpis: [
      { label: "My open tickets", value: String(mine.length) },
      { label: "Urgent / high", value: String(urgentCount) },
      { label: "No update 24h+", value: String(stale.length) },
      { label: "Overdue follow-ups", value: String(overdue.length) }
    ],
    groups: mine.length ? [{ title: "By priority", rows: countBy(mine, (t) => label(t.priority)) }] : [],
    items: mine.length
      ? {
          title: "My tickets — most urgent first",
          columns: ["Ticket", "Customer", "Subject", "Priority", "Status", "No update"],
          rows: withIdle.slice(0, 15).map(({ t, idle }) => ({
            cells: [`#${t.ticketNumber}`, t.customerName || t.customerEmail || "—", t.subject, t.priority, t.status, ageText(idle)],
            prompt: `Show ticket ${t.ticketNumber}`
          }))
        }
      : null,
    moreItems: followUps.length
      ? [{
          title: "Follow-ups for my customers",
          columns: ["Due", "Customer", "Follow-up"],
          rows: followUps.slice(0, 10).map((f) => ({
            cells: [f.due ? `${f.due}${f.overdue ? " (overdue)" : ""}` : "No date", f.customer, f.subject],
            prompt: `Pull up customer ${f.email}`
          }))
        }]
      : [],
    note: [
      mine.length === 0 ? "No unresolved tickets are assigned to you." : "",
      scan.capped ? "Only your 1,000 most recently updated tickets were checked." : "",
      crmNote
    ].filter(Boolean).join(" ") || null,
    displayed:
      "The rep now sees a 'My day' card: headline counts, their tickets (most urgent first, clickable) and follow-ups for their customers. " +
      "Do NOT restate any of it. Reply with ONE line saying what to tackle first (e.g. 'Start with #123 — urgent and untouched for 2 days.') or that the day is clear."
  };
}

export function buildTeamStatsTools() {
  const getTeamStats = tool({
    description:
      "Team / team-lead statistics counted live from real orders and tickets — use for questions like " +
      "'returns this week by reason', 'top returned products', 'which customers have been waiting more than 24h', " +
      "'tickets with no reply', 'ticket workload by agent', 'unassigned tickets count', 'orders this week', 'revenue today'. " +
      "NOT for 'latest / last / most recent order(s)' or 'show open orders' — use get_latest_orders, which isn't limited to a period. " +
      "Read-only, no approval. The studio shows the result as a stats card with clickable rows.",
    inputSchema: z.object({
      metric: z
        .enum(["returns", "waiting_tickets", "ticket_workload", "orders"])
        .describe(
          "returns: returns by reason/product in the period. waiting_tickets: unresolved tickets with no update for `waitingHours`+. " +
            "ticket_workload: active tickets by assignee/priority/category. orders: orders, revenue and shipping in the period."
        ),
      periodDays: z
        .number()
        .int()
        .describe("Look-back window in days: 1 for today, 7 for this/last week, 30 for this month. Use 7 when the rep didn't say."),
      waitingHours: z.number().int().describe("For waiting_tickets only: minimum hours without an update (default 24). Use 24 for other metrics.")
    }),
    execute: async ({ metric, periodDays, waitingHours }) => {
      const days = Math.min(Math.max(Math.round(periodDays) || 7, 1), 365);
      const hours = Math.min(Math.max(Math.round(waitingHours) || 24, 1), 24 * 90);
      try {
        const result =
          metric === "returns" ? await returnsStats(days)
          : metric === "waiting_tickets" ? await waitingStats(hours)
          : metric === "ticket_workload" ? await workloadStats(days)
          : await ordersStats(days);
        log.info("tool get_team_stats", { metric, days, hours, kpis: result.kpis.map((k) => k.value).join("/") });
        return result;
      } catch (err) {
        const message = String(err);
        const source = metric === "returns" || metric === "orders" ? "commerce" : "ticketing";
        log.info("tool get_team_stats", { metric, ok: false });
        return {
          error: message,
          unavailable: source,
          tell:
            source === "ticketing" && /authori[sz]ation|401|403|credential/i.test(message)
              ? "Tell the rep in one line that this project's ticketing connection was rejected (its credentials need fixing by an admin in the project settings), so ticket stats can't be counted right now. Do not offer to create a ticket."
              : `Tell the rep in one line that the ${source} system couldn't be reached, so these stats can't be counted right now. Do not offer to create a ticket.`
        };
      }
    }
  });

  const getMyDay = tool({
    description:
      "The logged-in rep's own day: 'what's on my plate', 'my tickets', 'what should I do first', 'start of shift'. " +
      "Their unresolved tickets (most urgent first), tickets untouched 24h+, and open CRM follow-ups for those customers. Read-only.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const result = await myDayStats();
        log.info("tool get_my_day", { kpis: result.kpis.map((k) => k.value).join("/") });
        return result;
      } catch (err) {
        const message = String(err);
        return {
          error: message,
          tell: /authori[sz]ation|401|403|credential/i.test(message)
            ? "Tell the rep in one line that this project's ticketing connection was rejected (an admin needs to fix its credentials), so their tickets can't be loaded. Do not offer to create a ticket."
            : "Tell the rep in one line that their tickets couldn't be loaded right now. Do not offer to create a ticket."
        };
      }
    }
  });

  return instrumentTools({ get_team_stats: getTeamStats, get_my_day: getMyDay }, log);
}
