import { NextRequest, NextResponse } from 'next/server';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

type BffResult = { ok: true; results: any[] } | { ok: false; reason: string };

// No mock data here. `ok` distinguishes "BFF reachable, genuinely zero
// matches" from "BFF unreachable/erroring" — only the latter is reported as
// an error, never papered over with fake products.
async function queryBffProducts(query: string): Promise<BffResult> {
  try {
    // NOTE: there is no `searchProducts` field on the schema — the real
    // field is `quickSearchProducts`. The old query here always failed
    // GraphQL validation, so this route silently served mock data on every
    // single request regardless of BFF health.
    const res = await fetch(BFF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csa-commerce-platform': 'commercetools' },
      body: JSON.stringify({
        query: `query QuickSearchProducts($q: String!, $limit: Int) {
          quickSearchProducts(q: $q, limit: $limit) {
            id sku name description imageUrl price { centAmount currencyCode fractionDigits }
          }
        }`,
        variables: { q: query || 'vacuum', limit: 10 },
      }),
    });
    if (!res.ok) return { ok: false, reason: `BFF returned HTTP ${res.status}` };
    const data = await res.json();
    if (data?.errors?.length) return { ok: false, reason: data.errors.map((e: any) => e.message).join('; ') };
    const results = data?.data?.quickSearchProducts;
    if (!Array.isArray(results)) return { ok: false, reason: 'Malformed response from commerce backend' };

    return {
      ok: true,
      results: results.map((p: any) => {
        const val = p.price ? (p.price.centAmount / Math.pow(10, p.price.fractionDigits || 2)).toFixed(2) : '0.00';
        return {
          id: p.id,
          sku: p.sku || 'SKU-GEN',
          name: p.name || 'Product Item',
          description: p.description || 'CommerceTools store product.',
          price: `$${val}`,
          formattedPrice: `$${val}`,
          image: p.imageUrl || 'https://images.unsplash.com/photo-1585336261026-6757c54e3ed7?w=150',
          inStock: true,
        };
      }),
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function handle(query: string) {
  const bff = await queryBffProducts(query);

  if (!bff.ok) {
    console.error(`[product-search] commerce backend unavailable: ${bff.reason}`);
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
