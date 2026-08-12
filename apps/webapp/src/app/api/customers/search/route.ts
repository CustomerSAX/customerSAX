import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

type BffResult = { ok: true; results: any[] } | { ok: false; reason: string };

// No mock data here. `ok` distinguishes "BFF reachable, genuinely zero
// matches" (real empty result, returned as-is) from "BFF unreachable/erroring"
// (a real failure, reported as an error — never papered over with fake
// customers). A caller — human agent or the AI assistant — must always be
// able to tell "this customer doesn't exist" apart from "our system couldn't
// answer that right now."
async function queryBffCustomers(query: string): Promise<BffResult> {
  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csa-commerce-platform': 'commercetools' },
      body: JSON.stringify({
        query: `query SearchCustomers($text: String) {
          searchCustomers(text: $text, limit: 10) {
            results { id email firstName lastName companyName createdAt }
          }
        }`,
        variables: { text: query || undefined },
      }),
    });
    if (!res.ok) return { ok: false, reason: `BFF returned HTTP ${res.status}` };
    const data = await res.json();
    if (data?.errors?.length) return { ok: false, reason: data.errors.map((e: any) => e.message).join('; ') };
    const results = data?.data?.searchCustomers?.results;
    if (!Array.isArray(results)) return { ok: false, reason: 'Malformed response from commerce backend' };

    return {
      ok: true,
      results: results.map((c: any) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.email || 'Customer',
        email: c.email || '',
        initials: (c.firstName?.[0] || c.email?.[0] || 'C').toUpperCase(),
        phone: '+1 555 0100',
        createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
        orderCount: 1,
        lifetimeValue: 'USD 120.00',
        status: 'Active',
      })),
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function handle(query: string) {
  const bff = await queryBffCustomers(query);

  if (!bff.ok) {
    console.error(`[customers/search] commerce backend unavailable: ${bff.reason}`);
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.', results: [], total: 0 },
      { status: 502 }
    );
  }

  return NextResponse.json({ results: bff.results, total: bff.results.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const query = (body.query || body.search || body.text || '').toLowerCase().trim();

  return handle(query);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || url.searchParams.get('q') || '').toLowerCase().trim();

  return handle(query);
}
