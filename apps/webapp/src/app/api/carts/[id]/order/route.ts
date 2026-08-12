import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

const HEADERS = {
  'content-type': 'application/json',
  'x-csa-commerce-platform': 'commercetools',
};

async function bff(query: string, variables?: Record<string, unknown>) {
  const res = await projectScopedBffFetch(BFF_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`BFF HTTP ${res.status}`);
  const data = await res.json();
  if (data?.errors?.length)
    throw new Error(data.errors.map((e: { message: string }) => e.message).join('; '));
  return data?.data;
}

/** POST /api/carts/[id]/order — place an order from the cart */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await bff(
      `mutation PlaceOrder($id: ID!) {
        placeOrderFromCart(id: $id)
      }`,
      { id },
    );

    const rawOrder = data?.placeOrderFromCart;
    const order = (rawOrder?.createOrderFromCart ?? rawOrder) as { id?: string; orderNumber?: string; totalPrice?: { centAmount?: number; currencyCode?: string; fractionDigits?: number } } | undefined;
    if (!order?.id) {
      return NextResponse.json(
        { error: 'Commerce backend returned no order after placing.' },
        { status: 502 },
      );
    }

    // Format the total for the caller so they don't need to compute it.
    const tp = order.totalPrice as { centAmount?: number; currencyCode?: string; fractionDigits?: number } | undefined;
    let totalLabel: string | null = null;
    if (tp?.centAmount != null && tp?.currencyCode) {
      const symbols: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' };
      const amount = (tp.centAmount / 100).toFixed(tp.fractionDigits ?? 2);
      totalLabel = (symbols[tp.currencyCode] ?? tp.currencyCode + ' ') + amount;
    }

    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber ?? null,
      totalLabel,
    });
  } catch (err) {
    console.error(`[POST /api/carts/${id}/order]`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to reach the commerce backend right now.' },
      { status: 502 },
    );
  }
}
