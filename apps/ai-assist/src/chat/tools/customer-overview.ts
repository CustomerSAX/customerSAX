/**
 * Customer snapshot — "jane@acme.com just called".
 *
 * Read-only. Resolves the customer, then fetches in parallel their recent
 * orders (with 12-month spend for the VIP flag), active carts, tickets and CRM
 * contact. Each section carries its own status — `ok`, or `error` with the
 * real reason (e.g. no CRM connected, ticketing credentials rejected) — so one
 * unavailable system never hides the others or turns into a fake "none".
 * The studio renders the result as a customer snapshot card with actions.
 */

import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { bffQuery, formatMoney } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";
import { instrumentTools } from "./instrument.js";

const log = createLogger("ai-assist").child({ module: "tools/customer-overview" });

type Money = { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null | undefined;

type Customer = {
  id: string;
  customerNumber?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  customerGroup?: { name?: string | null; key?: string | null } | null;
  createdAt?: string | null;
};

type Section<T> = { ok: true; data: T } | { ok: false; error: string };

const CUSTOMER_FIELDS = "id customerNumber email firstName lastName companyName customerGroup { id key name } createdAt";

const fullName = (c: Customer) => [c.firstName, c.lastName].filter(Boolean).join(" ").trim();

async function section<T>(run: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (err) {
    return { ok: false, error: String(err).replace(/^Error:\s*/, "").replace(/^GraphQL error:\s*/, "").slice(0, 200) };
  }
}

async function resolveCustomer(input: { email?: string; customerId?: string; name?: string }) {
  if (input.customerId || input.email) {
    const data = await bffQuery<{ customer: Customer | null }>(
      `query OverviewCustomer($id: ID, $email: String) { customer(id: $id, email: $email) { ${CUSTOMER_FIELDS} } }`,
      { id: input.customerId, email: input.email }
    );
    return data.customer ? [data.customer] : [];
  }
  const data = await bffQuery<{ searchCustomers: { results: Customer[] } }>(
    `query OverviewSearch($text: String, $limit: Int) { searchCustomers(text: $text, limit: $limit) { results { ${CUSTOMER_FIELDS} } } }`,
    { text: input.name, limit: 6 }
  );
  return data.searchCustomers?.results ?? [];
}

async function ordersFor(email: string, vipThreshold: number) {
  const data = await bffQuery<{
    orderPage: {
      total: number;
      results: Array<{
        id: string;
        orderNumber?: string | null;
        createdAt: string;
        orderState?: string | null;
        state?: string | null;
        shipmentState?: string | null;
        paymentState?: string | null;
        totalPrice?: Money;
        lineItems?: Array<{ quantity: number }>;
      }>;
    };
  }>(
    `query OverviewOrders($customerEmail: String, $limit: Int) {
      orderPage(customerEmail: $customerEmail, limit: $limit, sortKey: "createdAt", sortOrder: "desc") {
        total
        results { id orderNumber createdAt orderState state shipmentState paymentState totalPrice { centAmount currencyCode fractionDigits } lineItems { quantity } }
      }
    }`,
    { customerEmail: email, limit: 100 }
  );
  const all = data.orderPage?.results ?? [];
  const yearAgo = Date.now() - 365 * 86_400_000;
  // 12-month spend per currency — never adds different currencies together.
  const spend = new Map<string, { centAmount: number; fractionDigits: number }>();
  for (const o of all) {
    if (new Date(o.createdAt).getTime() < yearAgo || (o.orderState ?? o.state) === "Cancelled") continue;
    const m = o.totalPrice;
    if (!m?.currencyCode || typeof m.centAmount !== "number") continue;
    const cur = spend.get(m.currencyCode) ?? { centAmount: 0, fractionDigits: m.fractionDigits ?? 2 };
    cur.centAmount += m.centAmount;
    spend.set(m.currencyCode, cur);
  }
  const spend12m = [...spend.entries()].map(([currencyCode, v]) => ({
    currencyCode,
    amount: v.centAmount / 10 ** v.fractionDigits,
    display: formatMoney({ centAmount: v.centAmount, currencyCode, fractionDigits: v.fractionDigits })
  }));
  return {
    totalOrders: data.orderPage?.total ?? all.length,
    // Counted from up to the 100 newest orders.
    spendCapped: all.length === 100,
    spend12m,
    vip: spend12m.some((s) => s.amount >= vipThreshold),
    recent: all.slice(0, 5).map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber || o.id,
      date: o.createdAt.slice(0, 10),
      status: o.orderState ?? o.state ?? null,
      shipmentState: o.shipmentState ?? null,
      paymentState: o.paymentState ?? null,
      total: o.totalPrice ? formatMoney(o.totalPrice) : null,
      itemCount: (o.lineItems ?? []).reduce((n, l) => n + l.quantity, 0)
    }))
  };
}

async function cartsFor(email: string) {
  const data = await bffQuery<{
    searchCarts: { results: Array<{ id: string; cartState?: string; lastModifiedAt?: string; totalPrice?: Money; lineItems?: Array<{ quantity: number }> }> };
  }>(
    `query OverviewCarts($text: String!, $limit: Int) {
      searchCarts(text: $text, limit: $limit) {
        results { id cartState lastModifiedAt totalPrice { centAmount currencyCode fractionDigits } lineItems { quantity } }
      }
    }`,
    { text: email, limit: 20 }
  );
  return (data.searchCarts?.results ?? [])
    .filter((c) => c.cartState === "Active")
    .sort((a, b) => String(b.lastModifiedAt ?? "").localeCompare(String(a.lastModifiedAt ?? "")))
    .map((c) => ({
      cartId: c.id,
      itemCount: (c.lineItems ?? []).reduce((n, l) => n + l.quantity, 0),
      total: c.totalPrice ? formatMoney(c.totalPrice) : null,
      lastModifiedAt: c.lastModifiedAt?.slice(0, 10) ?? null
    }));
}

async function ticketsFor(email: string) {
  const data = await bffQuery<{
    ticketPage: {
      total: number;
      results: Array<{ id: string; ticketNumber: string; subject: string; status: string; priority: string; lastModifiedAt?: string | null }>;
    };
  }>(
    `query OverviewTickets($customerEmail: String, $limit: Int) {
      ticketPage(customerEmail: $customerEmail, limit: $limit) {
        total
        results { id ticketNumber subject status priority lastModifiedAt }
      }
    }`,
    { customerEmail: email, limit: 20 }
  );
  const results = data.ticketPage?.results ?? [];
  const active = results.filter((t) => !["resolved", "closed", "solved", "done"].includes(t.status?.trim().toLowerCase() ?? ""));
  return {
    total: data.ticketPage?.total ?? results.length,
    openCount: active.length,
    recent: (active.length ? active : results).slice(0, 5).map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      lastUpdate: t.lastModifiedAt?.slice(0, 10) ?? null
    }))
  };
}

async function crmFor(email: string) {
  const data = await bffQuery<{
    crmContactByEmail: { id: string; fullName?: string | null; title?: string | null; accountName?: string | null; ownerName?: string | null; externalUrl?: string | null } | null;
  }>(
    `query OverviewCrm($email: String!) { crmContactByEmail(email: $email) { id fullName title accountName ownerName externalUrl } }`,
    { email }
  );
  const contact = data.crmContactByEmail;
  if (!contact) return null;
  const acts = await bffQuery<{
    crmContactActivities: Array<{ type?: string | null; subject?: string | null; completed?: boolean | null; activityDate?: string | null; createdAt?: string | null }>;
  }>(
    `query OverviewCrmActivities($id: ID!, $limit: Int) { crmContactActivities(contactId: $id, limit: $limit) { type subject completed activityDate createdAt } }`,
    { id: contact.id, limit: 20 }
  );
  const activities = acts.crmContactActivities ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const openTasks = activities.filter((a) => a.type === "TASK" && a.completed === false);
  const last = [...activities].sort((a, b) => String(b.activityDate ?? b.createdAt ?? "").localeCompare(String(a.activityDate ?? a.createdAt ?? "")))[0];
  return {
    contactId: contact.id,
    name: contact.fullName ?? null,
    title: contact.title ?? null,
    company: contact.accountName ?? null,
    owner: contact.ownerName ?? null,
    url: contact.externalUrl ?? null,
    openFollowUps: openTasks.length,
    overdueFollowUps: openTasks.filter((a) => a.activityDate && a.activityDate.slice(0, 10) <= today).length,
    lastActivity: last ? { type: last.type ?? null, subject: last.subject ?? null, date: (last.activityDate ?? last.createdAt)?.slice(0, 10) ?? null } : null
  };
}

export function buildCustomerOverviewTools() {
  const getCustomerOverview = tool({
    description:
      "One-call customer snapshot for when a customer contacts the rep ('jane@acme.com just called', 'pull up Acme', 'who is this customer'): " +
      "profile, VIP flag from 12-month spend, recent orders, active carts, tickets and CRM contact with follow-ups. Read-only. " +
      "Prefer email; use name when that's all the rep gave. The studio shows the result as a customer card with action buttons.",
    inputSchema: z.object({
      email: z.string().describe("Customer email when known, else empty string"),
      customerId: z.string().describe("Commerce customer id when known, else empty string"),
      name: z.string().describe("Customer or company name when no email/id is known, else empty string")
    }),
    execute: async (raw) => {
      const ctx = getSystemPromptContext();
      const input = {
        email: raw.email?.trim() || undefined,
        customerId: raw.customerId?.trim() || undefined,
        name: raw.name?.trim() || undefined
      };
      if (!input.email && !input.customerId && !input.name) return { error: "Give an email, customer id or name." };
      try {
        const matches = await resolveCustomer(input);
        if (matches.length === 0) {
          return { found: false, searched: input.email ?? input.customerId ?? input.name, note: "No customer matches this." };
        }
        if (matches.length > 1) {
          return {
            found: false,
            matches: matches.map((c) => ({ customerId: c.id, name: fullName(c) || null, email: c.email ?? null, company: c.companyName ?? null })),
            note: "Several customers match — the studio shows them as choices."
          };
        }
        const customer = matches[0];
        const email = customer.email ?? "";
        const vipThreshold = Number(ctx.vipThreshold ?? 50000) || 50000;
        const none = <T,>(): Promise<Section<T>> => Promise.resolve({ ok: false, error: "Customer has no email on record" });
        const [orders, carts, tickets, crm] = await Promise.all([
          email ? section(() => ordersFor(email, vipThreshold)) : none<Awaited<ReturnType<typeof ordersFor>>>(),
          email ? section(() => cartsFor(email)) : none<Awaited<ReturnType<typeof cartsFor>>>(),
          email ? section(() => ticketsFor(email)) : none<Awaited<ReturnType<typeof ticketsFor>>>(),
          !ctx.canViewCustomers
            ? Promise.resolve<Section<null>>({ ok: false, error: "No permission to view CRM records" })
            : email ? section(() => crmFor(email)) : none<Awaited<ReturnType<typeof crmFor>>>()
        ]);
        log.info("tool get_customer_overview", { targetId: customer.id, orders: orders.ok, carts: carts.ok, tickets: tickets.ok, crm: crm.ok });
        return {
          found: true,
          customer: {
            customerId: customer.id,
            name: fullName(customer) || null,
            email: customer.email ?? null,
            customerNumber: customer.customerNumber ?? null,
            company: customer.companyName ?? null,
            group: customer.customerGroup?.name ?? customer.customerGroup?.key ?? null,
            since: customer.createdAt?.slice(0, 10) ?? null
          },
          vipThreshold,
          orders,
          carts,
          tickets,
          crm,
          displayed:
            "The rep now sees a customer snapshot card: profile, VIP/Standard badge with 12-month spend, recent orders, active cart, open tickets and CRM follow-ups, " +
            "each with action buttons. Do NOT restate any of it. Reply with ONE line naming what needs attention first (e.g. an overdue follow-up, an urgent open ticket, " +
            "an unshipped paid order) — or that nothing is pending. If a section has ok:false, mention it in a few words (e.g. 'tickets couldn't be loaded')."
        };
      } catch (err) {
        return { error: String(err) };
      }
    }
  });

  return instrumentTools({ get_customer_overview: getCustomerOverview }, log);
}
