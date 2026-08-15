import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { requestLogger } from '@/lib/request-logger';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

// No mock data here. The stepper sends whatever `id` this route returns
// straight back to the AI as the hidden-action's shippingMethodId — the old
// hardcoded "express"/"standard"/"overnight" ids were never real
// commercetools shipping method ids, so the AI could never actually set one
// (and previously had no tool to do so anyway; that gap is fixed separately).
export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/shipping-methods');
  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csa-commerce-platform': 'commercetools' },
      body: JSON.stringify({
        query: `query ShippingMethods($limit: Int) {
          shippingMethods(limit: $limit) { id key name }
        }`,
        variables: { limit: 20 },
      }),
    }, requestId);
    if (!res.ok) {
      return NextResponse.json({ error: 'Unable to reach the commerce backend right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    const data = await res.json();
    if (data?.errors?.length) {
      log.error('commerce backend error', undefined, { message: data.errors.map((e: any) => e.message).join('; ') });
      return NextResponse.json({ error: 'Unable to reach the commerce backend right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    const results = data?.data?.shippingMethods;
    if (!Array.isArray(results)) {
      return NextResponse.json({ error: 'Unable to reach the commerce backend right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    const methods = results.map((m: { id: string; key?: string; name?: string }) => ({
      id: m.id,
      name: m.name || m.key || 'Shipping method',
    }));

    return NextResponse.json(methods, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('fetch failed', err);
    return NextResponse.json({ error: 'Unable to reach the commerce backend right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
