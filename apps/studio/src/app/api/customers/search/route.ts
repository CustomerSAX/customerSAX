import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { bffJsonHeaders } from '@/lib/commerce-headers';
import { requestLogger } from '@/lib/request-logger';
import { formatDate } from '@/lib/format-date';
import type { Logger } from '@csa/logger/client';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

type BffCustomer = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  createdAt?: string;
};
type GraphqlError = { message?: string };
type GraphqlResponse<T> = { data?: T; errors?: GraphqlError[] };
type CustomerSearchResult = {
  id: string;
  name: string;
  email: string;
  initials: string;
  phone: null;
  createdAt: string | null;
  orderCount: null;
  lifetimeValue: null;
  status: 'Active';
};
type BffResult = { ok: true; results: CustomerSearchResult[] } | { ok: false; reason: string };

function graphqlErrorMessage(errors: GraphqlError[]) {
  return errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
}

// No mock data here. `ok` distinguishes "BFF reachable, genuinely zero
// matches" (real empty result, returned as-is) from "BFF unreachable/erroring"
// (a real failure, reported as an error — never papered over with fake
// customers). A caller — human agent or the AI assistant — must always be
// able to tell "this customer doesn't exist" apart from "our system couldn't
// answer that right now."
async function queryBffCustomers(query: string, requestId: string): Promise<BffResult> {
  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: bffJsonHeaders(),
      body: JSON.stringify({
        query: `query SearchCustomers($text: String) {
          searchCustomers(text: $text, limit: 10) {
            results { id email firstName lastName companyName createdAt }
          }
        }`,
        variables: { text: query || undefined },
      }),
    }, requestId);
    if (!res.ok) return { ok: false, reason: `BFF returned HTTP ${res.status}` };
    const data = (await res.json()) as GraphqlResponse<{ searchCustomers?: { results?: BffCustomer[] } }>;
    if (data.errors?.length) return { ok: false, reason: graphqlErrorMessage(data.errors) };
    const results = data?.data?.searchCustomers?.results;
    if (!Array.isArray(results)) return { ok: false, reason: 'Malformed response from commerce backend' };

    return {
      ok: true,
      results: results.map((c) => ({
        id: c.id ?? '',
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.email || 'Customer',
        email: c.email || '',
        initials: (c.firstName?.[0] || c.email?.[0] || 'C').toUpperCase(),
        // phone, orderCount, and lifetimeValue are not returned by the CT
        // searchCustomers query — they are genuinely absent, not fabricated.
        // Callers must treat null as "data unavailable", not "no orders / no phone".
        phone: null,
        createdAt: c.createdAt ? formatDate(c.createdAt) : null,
        orderCount: null,
        lifetimeValue: null,
        status: 'Active', // all customers returned by CT search are active
      })),
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function handle(query: string, log: Logger, requestId: string) {
  const bff = await queryBffCustomers(query, requestId);

  if (!bff.ok) {
    log.error('commerce backend unavailable', undefined, { reason: bff.reason });
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.', results: [], total: 0 },
      { status: 502 }
    );
  }

  return NextResponse.json({ results: bff.results, total: bff.results.length });
}

export async function POST(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/customers/search');
  const body = await request.json().catch(() => ({}));
  const query = (body.query || body.search || body.text || '').toLowerCase().trim();

  return handle(query, log, requestId);
}

export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/customers/search');
  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || url.searchParams.get('q') || '').toLowerCase().trim();

  return handle(query, log, requestId);
}
