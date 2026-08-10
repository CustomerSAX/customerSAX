import type { BadgeVariant } from "@csa/ui";
import type { AuditActionClass, AuditDateRangeKey, AuditLogEntry } from "../types/audit-log-types";

export const DATE_RANGE_OPTIONS: { value: AuditDateRangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thismonth", label: "This month" },
  { value: "lastmonth", label: "Last month" },
];

export const ACTION_BADGE_VARIANT: Record<AuditActionClass, BadgeVariant> = {
  "a-create": "info",
  "a-edit": "warning",
  "a-remove": "error",
  "a-view": "neutral",
  "a-approve": "success",
  "a-denied": "error",
};

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function isWithinDateRange(iso: string, range: AuditDateRangeKey, now: Date = new Date()): boolean {
  const ts = new Date(iso);
  switch (range) {
    case "today":
      return ts >= startOfDay(now) && ts <= endOfDay(now);
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return ts >= startOfDay(yesterday) && ts <= endOfDay(yesterday);
    }
    case "last7": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return ts >= start && ts <= now;
    }
    case "last30": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return ts >= start && ts <= now;
    }
    case "thismonth":
      return ts.getFullYear() === now.getFullYear() && ts.getMonth() === now.getMonth();
    case "lastmonth": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return ts.getFullYear() === lastMonth.getFullYear() && ts.getMonth() === lastMonth.getMonth();
    }
    default:
      return true;
  }
}

/**
 * Mirrors the real `logCsaAuditEvent` call-site matrix from the legacy app
 * (Auth, Customers, Tickets, Products, Orders, Cart, Quotes, User Management) —
 * not the legacy mock seeder's mismatched action list, which included actions
 * ("Report exported", "Access denied") no real code path ever writes.
 */
export function generateAuditLogEntries(): AuditLogEntry[] {
  const now = new Date();

  const daysAgo = (n: number, hour: number, minute: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const lastMonthDay = (day: number, hour: number, minute: number): string => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, day, hour, minute, 0, 0);
    return d.toISOString();
  };

  const thisMonthEarly = (hour: number, minute: number): string => {
    const day = Math.min(3, now.getDate());
    const d = new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0);
    return d.toISOString();
  };

  const AGENTS = [
    { agent: "Pooja N.", userEmail: "pooja.n@royalcyber.com", ip: "10.20.4.11" },
    { agent: "Stephen A.", userEmail: "stephen.a@royalcyber.com", ip: "10.20.4.18" },
    { agent: "Maria Chen", userEmail: "maria.chen@royalcyber.com", ip: "10.20.4.27" },
  ];

  let seq = 0;
  const entry = (
    partial: Omit<AuditLogEntry, "id" | "agent" | "userEmail" | "ipAddress" | "sessionId" | "result"> & {
      agentIndex: number;
      result?: AuditLogEntry["result"];
    },
  ): AuditLogEntry => {
    seq += 1;
    const who = AGENTS[partial.agentIndex];
    return {
      id: `audit-${seq}`,
      agent: who.agent,
      userEmail: who.userEmail,
      ipAddress: who.ip,
      sessionId: `sess_${(1000 + seq).toString(36)}`,
      result: partial.result ?? "Success",
      timestamp: partial.timestamp,
      action: partial.action,
      actionClass: partial.actionClass,
      module: partial.module,
      entity: partial.entity,
      details: partial.details,
      fields: partial.fields,
    };
  };

  return [
    entry({
      agentIndex: 0,
      timestamp: daysAgo(0, 8, 42),
      action: "Login",
      actionClass: "a-view",
      module: "Auth",
      entity: "—",
      details: "Signed in from Chrome / Windows",
      fields: [{ label: "Method", value: "SSO" }],
    }),
    entry({
      agentIndex: 1,
      timestamp: daysAgo(0, 9, 5),
      action: "Ticket created",
      actionClass: "a-create",
      module: "Tickets",
      entity: "CSA-1024",
      details: "Created via Escalate flow",
      fields: [{ label: "Priority", value: "High" }],
    }),
    entry({
      agentIndex: 0,
      timestamp: daysAgo(0, 11, 30),
      action: "Order edited",
      actionClass: "a-edit",
      module: "Orders",
      entity: "ORD-54019",
      details: "Updated shipping method",
      fields: [{ label: "Shipping Method", before: "Standard", after: "Express" }],
    }),
    entry({
      agentIndex: 2,
      timestamp: daysAgo(1, 10, 12),
      action: "Customer edited",
      actionClass: "a-edit",
      module: "Customers",
      entity: "cst-1002",
      details: "Updated contact details",
      fields: [{ label: "Phone", before: "+1 312 555 0110", after: "+1 312 555 0199" }],
    }),
    entry({
      agentIndex: 1,
      timestamp: daysAgo(1, 15, 50),
      action: "Discount applied",
      actionClass: "a-edit",
      module: "Orders",
      entity: "ORD-54021",
      details: "Applied promo code at checkout",
      fields: [{ label: "Discount Code", value: "SUMMER10" }],
    }),
    entry({
      agentIndex: 0,
      timestamp: daysAgo(2, 9, 20),
      action: "Product searched",
      actionClass: "a-view",
      module: "Products",
      entity: "—",
      details: "Search query returned 14 results",
      fields: [
        { label: "Search Query", value: "wireless headset" },
        { label: "Results Returned", value: "14" },
      ],
    }),
    entry({
      agentIndex: 2,
      timestamp: daysAgo(2, 14, 5),
      action: "Address changed",
      actionClass: "a-edit",
      module: "Orders",
      entity: "ORD-54008",
      details: "Shipping address updated",
      fields: [{ label: "City", before: "Naperville", after: "Chicago" }],
    }),
    entry({
      agentIndex: 1,
      timestamp: daysAgo(4, 8, 15),
      action: "Refund issued",
      actionClass: "a-remove",
      module: "Orders",
      entity: "ORD-53988",
      details: "Full refund issued for damaged item",
      fields: [{ label: "Refund Amount", value: "$129.00" }],
    }),
    entry({
      agentIndex: 0,
      timestamp: daysAgo(4, 16, 40),
      action: "Ticket edited",
      actionClass: "a-edit",
      module: "Tickets",
      entity: "CSA-1019",
      details: "Reassigned and reprioritized",
      fields: [
        { label: "Assigned To", before: "Queue", after: "S. Patel" },
        { label: "Priority", before: "Normal", after: "High" },
      ],
    }),
    entry({
      agentIndex: 2,
      timestamp: daysAgo(6, 12, 0),
      action: "Cart edited",
      actionClass: "a-edit",
      module: "Cart",
      entity: "CART-7731",
      details: "Line item added to active cart",
      fields: [{ label: "Line Item", value: "Wireless Headset x1" }],
    }),
    entry({
      agentIndex: 1,
      timestamp: daysAgo(6, 17, 25),
      action: "Cart updated",
      actionClass: "a-edit",
      module: "Cart",
      entity: "CART-7729",
      details: "Quantity updated on existing line item",
      fields: [{ label: "Quantity", before: "1", after: "2" }],
    }),
    entry({
      agentIndex: 0,
      timestamp: daysAgo(9, 9, 45),
      action: "Quote approved",
      actionClass: "a-approve",
      module: "Quotes",
      entity: "QT-2201",
      details: "Buyer accepted seller counter-offer",
      fields: [{ label: "Final Price", value: "$4,200.00" }],
    }),
    entry({
      agentIndex: 2,
      timestamp: daysAgo(9, 13, 10),
      action: "Quote declined",
      actionClass: "a-denied",
      module: "Quotes",
      entity: "QT-2198",
      result: "Denied",
      details: "Seller declined buyer's requested terms",
      fields: [{ label: "Reason", value: "Below minimum margin" }],
    }),
    entry({
      agentIndex: 1,
      timestamp: daysAgo(14, 10, 30),
      action: "Quote withdrawn",
      actionClass: "a-remove",
      module: "Quotes",
      entity: "QT-2185",
      details: "Buyer withdrew open quote request",
      fields: [{ label: "Status", before: "Pending", after: "Withdrawn" }],
    }),
    entry({
      agentIndex: 0,
      timestamp: daysAgo(14, 15, 55),
      action: "Quote negotiated",
      actionClass: "a-edit",
      module: "Quotes",
      entity: "QT-2190",
      details: "Seller submitted counter-offer",
      fields: [{ label: "Offer Price", before: "$3,900.00", after: "$4,050.00" }],
    }),
    entry({
      agentIndex: 2,
      timestamp: daysAgo(21, 11, 15),
      action: "Agent added",
      actionClass: "a-create",
      module: "User Management",
      entity: "user-2044",
      details: "New agent onboarded to the workspace",
      fields: [{ label: "Role", value: "Agent" }],
    }),
    entry({
      agentIndex: 1,
      timestamp: daysAgo(21, 16, 5),
      action: "Agent edited",
      actionClass: "a-edit",
      module: "User Management",
      entity: "user-1988",
      details: "Updated agent display name",
      fields: [{ label: "Display Name", before: "S. A.", after: "Stephen A." }],
    }),
    entry({
      agentIndex: 0,
      timestamp: daysAgo(28, 9, 0),
      action: "Role changed",
      actionClass: "a-edit",
      module: "User Management",
      entity: "user-1975",
      details: "Elevated agent to admin role",
      fields: [{ label: "Role", before: "Agent", after: "Admin" }],
    }),
    entry({
      agentIndex: 2,
      timestamp: thisMonthEarly(10, 20),
      action: "Login",
      actionClass: "a-view",
      module: "Auth",
      entity: "—",
      details: "Signed in from Safari / macOS",
      fields: [{ label: "Method", value: "SSO" }],
    }),
    entry({
      agentIndex: 1,
      timestamp: lastMonthDay(5, 13, 40),
      action: "Order placed",
      actionClass: "a-create",
      module: "Orders",
      entity: "ORD-53810",
      details: "New order placed from quote",
      fields: [{ label: "Order Total", value: "$860.00" }],
    }),
    entry({
      agentIndex: 0,
      timestamp: lastMonthDay(20, 8, 50),
      action: "Product searched",
      actionClass: "a-view",
      module: "Products",
      entity: "—",
      details: "Search query returned 3 results",
      fields: [
        { label: "Search Query", value: "usb-c dock" },
        { label: "Results Returned", value: "3" },
      ],
    }),
  ];
}
