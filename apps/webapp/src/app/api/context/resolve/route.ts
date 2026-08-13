import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';

/**
 * GET /api/context/resolve?email=<email>&customerId=<id>&ticketId=<id>
 *
 * Deterministically resolves the full customer profile (member-since, order
 * count, lifetime value) for the right-panel Customer card — no AI involved.
 * Called when an agent selects a ticket so the sidebar's Since/Orders/Spent
 * stats populate with real data instead of staying blank forever.
 *
 * When `ticketId` is provided, the route first fetches the ticket to extract
 * the customer email and customerId, then proceeds with normal customer
 * resolution. This lets ticket-context sessions populate the Customer card
 * without the caller having to know the customer's email upfront.
 */

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

async function bffQuery<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csa-commerce-platform': 'commercetools' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.errors?.length) return null;
    return data?.data ?? null;
  } catch {
    return null;
  }
}

function formatMoney(money: { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null | undefined) {
  if (!money?.currencyCode || typeof money.centAmount !== 'number') return null;
  const value = money.centAmount / Math.pow(10, money.fractionDigits ?? 2);
  // Explicit 'en-US' — toLocaleString(undefined, ...) falls back to the
  // server process's locale, which formatted this as "3,90,419.68" (Indian
  // digit grouping) instead of "390,419.68", inconsistent with money
  // formatting everywhere else in this app.
  return `${money.currencyCode} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  let email = url.searchParams.get('email')?.trim() || undefined;
  let customerId = url.searchParams.get('customerId')?.trim() || undefined;
  const ticketId = url.searchParams.get('ticketId')?.trim() || undefined;

  // If a ticketId is given, fetch the ticket first to extract customer coords.
  if (ticketId && !email && !customerId) {
    const ticketData = await bffQuery<{ ticket: { customerEmail?: string; customerId?: string } | null }>(
      `query GetTicketContext($id: ID!) { ticket(id: $id) { customerEmail customerId } }`,
      { id: ticketId }
    );
    const ticket = ticketData?.ticket;
    if (!ticket) {
      return NextResponse.json({ customer: null, note: 'Ticket not found' });
    }
    email = ticket.customerEmail ?? undefined;
    customerId = ticket.customerId ?? undefined;
  }

  if (!email && !customerId) {
    return NextResponse.json({ error: 'email, customerId, or ticketId query param required' }, { status: 400 });
  }

  // Step 1: resolve the real customer record (id-first, falling back to email).
  const customerData = await bffQuery<{ customer: any }>(
    `query Customer($id: ID, $email: String) {
      customer(id: $id, email: $email) {
        id email firstName lastName companyName createdAt customerGroup { name }
      }
    }`,
    { email: customerId ? undefined : email, id: customerId }
  );

  const customer = customerData?.customer;
  if (!customer) {
    return NextResponse.json({ customer: null });
  }

  // Step 2: order count + lifetime value for this customer.
  const ordersData = await bffQuery<{ orderPage: { total: number; results: Array<{ totalPrice: any }> } }>(
    `query CustomerOrders($customerId: ID) {
      orderPage(customerId: $customerId, limit: 100) {
        total
        results { totalPrice { centAmount currencyCode fractionDigits } }
      }
    }`,
    { customerId: customer.id }
  );

  const page = ordersData?.orderPage;
  let lifetimeValue: string | null = null;
  if (page?.results?.length) {
    const byCurrency = new Map<string, { centAmount: number; fractionDigits: number; count: number }>();
    for (const order of page.results) {
      const tp = order.totalPrice;
      if (!tp?.currencyCode || typeof tp.centAmount !== 'number') continue;
      const cur = byCurrency.get(tp.currencyCode) ?? { centAmount: 0, fractionDigits: tp.fractionDigits ?? 2, count: 0 };
      cur.centAmount += tp.centAmount;
      cur.count += 1;
      byCurrency.set(tp.currencyCode, cur);
    }
    // Sum in whichever currency the customer actually orders in most.
    let primary: { currencyCode: string; centAmount: number; fractionDigits: number } | null = null;
    for (const [currencyCode, agg] of byCurrency) {
      if (!primary || agg.count > (byCurrency.get(primary.currencyCode)?.count ?? 0)) {
        primary = { currencyCode, centAmount: agg.centAmount, fractionDigits: agg.fractionDigits };
      }
    }
    lifetimeValue = formatMoney(primary);
  }

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.companyName || customer.email;

  return NextResponse.json(
    {
      customer: {
        id: customer.id,
        name,
        email: customer.email,
        tier: customer.customerGroup?.name || 'Active',
        createdAt: customer.createdAt
          ? new Date(customer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : null,
        orderCount: page?.total ?? page?.results?.length ?? 0,
        lifetimeValue,
      },
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
