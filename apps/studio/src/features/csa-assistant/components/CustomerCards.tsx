"use client";

/**
 * Customer snapshot card, built from the real get_customer_overview result
 * (ai-assist chat/tools/customer-overview.ts). Each section shows its own
 * real state — data, empty, or the reason it couldn't load — never a filler.
 */

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";

type Section<T> = { ok: true; data: T } | { ok: false; error: string };

type Overview = {
  customer: {
    customerId: string;
    name: string | null;
    email: string | null;
    customerNumber: string | null;
    company: string | null;
    group: string | null;
    since: string | null;
  };
  orders: Section<{
    totalOrders: number;
    spendCapped: boolean;
    spend12m: Array<{ currencyCode: string; display: string }>;
    vip: boolean;
    recent: Array<{ orderId: string; orderNumber: string; date: string; status: string | null; shipmentState: string | null; paymentState: string | null; total: string | null; itemCount: number }>;
  }>;
  carts: Section<Array<{ cartId: string; itemCount: number; total: string | null; lastModifiedAt: string | null }>>;
  tickets: Section<{
    total: number;
    openCount: number;
    recent: Array<{ id: string; ticketNumber: string; subject: string; status: string; priority: string; lastUpdate: string | null }>;
  }>;
  crm: Section<{
    contactId: string;
    name: string | null;
    title: string | null;
    company: string | null;
    owner: string | null;
    url: string | null;
    openFollowUps: number;
    overdueFollowUps: number;
    lastActivity: { type: string | null; subject: string | null; date: string | null } | null;
  } | null>;
};

type Matches = Array<{ customerId: string; name: string | null; email: string | null; company: string | null }>;

export type CustomerOverviewResult = { kind: "overview"; overview: Overview } | { kind: "matches"; matches: Matches };

/** A get_customer_overview result (one customer, or several matches), or null. */
export function customerOverviewFromOutput(output: unknown): CustomerOverviewResult | null {
  const o = output as { found?: boolean; customer?: { customerId?: unknown }; matches?: unknown } | null;
  if (o?.found === true && typeof o.customer?.customerId === "string") return { kind: "overview", overview: o as unknown as Overview };
  if (o?.found === false && Array.isArray(o.matches) && o.matches.length > 1) return { kind: "matches", matches: o.matches as Matches };
  return null;
}

const shipVariant = (s: string | null) => (s === "Delivered" || s === "Shipped" ? "success" : s === "Delayed" || s === "Backorder" ? "warning" : "neutral");
const prioVariant = (p: string) => (/urgent|high/i.test(p) ? "error" : "neutral");

function SectionBlock({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="pt-2 border-t border-m-border">
      <p className="font-semibold text-m-text mb-1 flex items-center gap-1.5">
        <Icon name={icon} size="xs" className="text-m-text-muted" />
        {title}
      </p>
      {children}
    </div>
  );
}

const Unavailable = ({ error }: { error: string }) => <p className="text-m-text-muted">Couldn&apos;t load: {error}</p>;

export function CustomerOverviewCard({
  result,
  onSuggest,
  isLoading = false
}: {
  result: CustomerOverviewResult;
  onSuggest?: (prompt: string) => void;
  isLoading?: boolean;
}) {
  const canAct = !!onSuggest && !isLoading;
  const ask = (prompt: string) => canAct && onSuggest!(prompt);

  if (result.kind === "matches") {
    return (
      <Card variant="default" className="my-2 w-full max-w-md">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon name="users" size="xs" className="text-m-primary" />
            Which customer?
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-1.5 text-xs">
          {result.matches.map((m) => (
            <button
              key={m.customerId}
              type="button"
              disabled={!canAct}
              onClick={() => ask(`Pull up customer ${m.email || m.customerId}`)}
              className="w-full text-left rounded-m-md border border-m-border px-3 py-2 hover:bg-m-surface-2 disabled:opacity-50"
            >
              <span className="font-medium text-m-text">{m.name || m.email || m.customerId}</span>
              <span className="block text-m-text-muted">{[m.email, m.company].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  const { customer, orders, carts, tickets, crm } = result.overview;
  const who = customer.email || customer.customerId;
  const cart = carts.ok ? carts.data[0] : undefined;
  return (
    <Card variant="default" className="my-2 w-full max-w-xl">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Icon name="user" size="xs" className="text-m-primary" />
              {customer.name || customer.email || "Customer"}
            </CardTitle>
            <p className="text-xs text-m-text-muted truncate">
              {[customer.email, customer.company, customer.group, customer.customerNumber ? `#${customer.customerNumber}` : null, customer.since ? `since ${customer.since}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {orders.ok && (
            <div className="text-right shrink-0">
              <Badge variant={orders.data.vip ? "success" : "neutral"} size="sm">{orders.data.vip ? "VIP" : "Standard"}</Badge>
              <p className="text-[11px] text-m-text-muted mt-0.5">
                {orders.data.spend12m.length ? orders.data.spend12m.map((s) => s.display).join(" + ") : "No spend"} / 12 mo
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2 text-xs">
        <SectionBlock title={orders.ok ? `Orders (${orders.data.totalOrders})` : "Orders"} icon="package">
          {!orders.ok ? <Unavailable error={orders.error} />
            : orders.data.recent.length === 0 ? <p className="text-m-text-muted">No orders yet.</p>
            : (
              <div className="space-y-0.5">
                {orders.data.recent.map((o) => (
                  <button
                    key={o.orderId}
                    type="button"
                    disabled={!canAct}
                    onClick={() => ask(`Show order ${o.orderNumber}`)}
                    className="w-full grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-m-sm px-1.5 py-1 text-left hover:bg-m-surface-2 disabled:cursor-default"
                  >
                    <span className="font-medium text-m-text">{o.orderNumber}</span>
                    <span className="text-m-text-muted truncate">{o.date} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}{o.paymentState ? ` · ${o.paymentState}` : ""}</span>
                    <Badge variant={shipVariant(o.shipmentState)} size="sm">{o.shipmentState ?? o.status ?? "—"}</Badge>
                    <span className="tabular-nums text-m-text">{o.total ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
        </SectionBlock>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <SectionBlock title="Cart" icon="shopping-cart">
            {!carts.ok ? <Unavailable error={carts.error} />
              : !cart ? <p className="text-m-text-muted">No active cart.</p>
              : (
                <p className="text-m-text">
                  {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}{cart.total ? ` · ${cart.total}` : ""}
                  <span className="block text-m-text-muted">
                    updated {cart.lastModifiedAt ?? "—"}{carts.data.length > 1 ? ` · ${carts.data.length - 1} older cart${carts.data.length > 2 ? "s" : ""}` : ""}
                  </span>
                </p>
              )}
          </SectionBlock>

          <SectionBlock title="CRM" icon="contact">
            {!crm.ok ? <Unavailable error={crm.error} />
              : !crm.data ? <p className="text-m-text-muted">No CRM contact with this email.</p>
              : (
                <div className="text-m-text space-y-0.5">
                  <p>
                    {[crm.data.title, crm.data.company].filter(Boolean).join(" · ") || crm.data.name}
                    {crm.data.owner && <span className="block text-m-text-muted">Owner: {crm.data.owner}</span>}
                  </p>
                  <p className="flex items-center gap-1.5">
                    {crm.data.openFollowUps} open follow-up{crm.data.openFollowUps === 1 ? "" : "s"}
                    {crm.data.overdueFollowUps > 0 && <Badge variant="error" size="sm">{crm.data.overdueFollowUps} overdue</Badge>}
                  </p>
                  {crm.data.lastActivity && (
                    <p className="text-m-text-muted truncate">Last: {crm.data.lastActivity.subject ?? crm.data.lastActivity.type} {crm.data.lastActivity.date ? `· ${crm.data.lastActivity.date}` : ""}</p>
                  )}
                </div>
              )}
          </SectionBlock>
        </div>

        <SectionBlock title={tickets.ok ? `Tickets (${tickets.data.openCount} open of ${tickets.data.total})` : "Tickets"} icon="ticket">
          {!tickets.ok ? <Unavailable error={tickets.error} />
            : tickets.data.recent.length === 0 ? <p className="text-m-text-muted">No tickets.</p>
            : (
              <div className="space-y-0.5">
                {tickets.data.recent.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!canAct}
                    onClick={() => ask(`Show ticket ${t.ticketNumber}`)}
                    className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-m-sm px-1.5 py-1 text-left hover:bg-m-surface-2 disabled:cursor-default"
                  >
                    <span className="font-medium text-m-text">#{t.ticketNumber}</span>
                    <span className="text-m-text truncate">{t.subject} <span className="text-m-text-muted">· {t.status}</span></span>
                    <Badge variant={prioVariant(t.priority)} size="sm">{t.priority}</Badge>
                  </button>
                ))}
              </div>
            )}
        </SectionBlock>

        {onSuggest && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-m-border">
            <Button size="sm" variant="primary" disabled={!canAct} leftIcon={<Icon name="shopping-cart" size="xs" />} onClick={() => ask(`Create an order for ${who}`)}>
              New order
            </Button>
            {cart && (
              <Button size="sm" variant="outline" disabled={!canAct} leftIcon={<Icon name="shopping-bag" size="xs" />} onClick={() => ask(`Show the cart for ${who}`)}>
                Open cart
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!canAct} leftIcon={<Icon name="ticket" size="xs" />} onClick={() => ask(`Create a ticket for ${who}`)}>
              Create ticket
            </Button>
            <Button size="sm" variant="outline" disabled={!canAct} leftIcon={<Icon name="map-pin" size="xs" />} onClick={() => ask(`Show addresses for ${who}`)}>
              Addresses
            </Button>
            {crm.ok && crm.data && (
              <Button size="sm" variant="outline" disabled={!canAct} leftIcon={<Icon name="phone" size="xs" />} onClick={() => ask(`Log a call with ${who} in the CRM`)}>
                Log call
              </Button>
            )}
            {crm.ok && crm.data?.url && (
              <a href={crm.data.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-m-primary hover:underline px-1">
                Open in CRM <Icon name="external-link" size="xs" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
