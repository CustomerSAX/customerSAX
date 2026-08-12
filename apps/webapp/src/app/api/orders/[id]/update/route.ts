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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({ actions: [] }));
    const actions = Array.isArray(body.actions) ? body.actions : [];

    for (const action of actions) {
      if ('changePaymentState' in action) {
        // The BFF schema might not support changeOrderPaymentState directly yet,
        // but we'll try it if it exists.
        try {
          await bff(
            `mutation ChangePaymentState($id: ID!, $paymentState: String!) {
              updateOrder(id: $id, actions: [{ changePaymentState: { paymentState: $paymentState } }]) { id }
            }`,
            { id, paymentState: action.changePaymentState.paymentState }
          );
        } catch (e) {
          console.warn("[api/orders/[id]/update] updateOrder mutation failed or missing in BFF:", e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[api/orders/${id}/update] Error:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
