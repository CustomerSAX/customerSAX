import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { bffJsonHeaders } from '@/lib/commerce-headers';
import { requestLogger } from '@/lib/request-logger';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';
type GraphqlResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

/**
 * GET /api/project-countries → string[] of the country codes set in the
 * active project's commercetools settings (the countries the store sells to).
 * The checkout panel offers only these, so the rep can't pick a country the
 * project rejects. Errors return 502 and the panel falls back to its own list.
 */
export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/project-countries');
  const fail = () =>
    NextResponse.json({ error: 'Unable to reach the commerce backend right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: bffJsonHeaders(),
      body: JSON.stringify({ query: 'query ProjectCountries { availableCountries }' }),
    }, requestId);
    if (!res.ok) return fail();
    const data = (await res.json()) as GraphqlResponse<{ availableCountries?: string[] }>;
    if (data.errors?.length) {
      log.error('commerce backend error', undefined, { message: data.errors.map((e) => e.message).join('; ') });
      return fail();
    }
    const countries = data.data?.availableCountries;
    if (!Array.isArray(countries)) return fail();
    return NextResponse.json(countries.filter((c) => typeof c === 'string' && c.trim()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('fetch failed', err);
    return fail();
  }
}
