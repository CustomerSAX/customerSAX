import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { requestLogger } from '@/lib/request-logger';
import { bffJsonHeaders } from '@/lib/commerce-headers';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

const HEADERS = bffJsonHeaders();

async function bffRaw(query: string, variables: Record<string, unknown> | undefined, requestId: string) {
  const res = await projectScopedBffFetch(BFF_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  }, requestId);
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
  const { log, requestId } = requestLogger(request, 'api/orders/[id]/update');
  const { id } = await params;
  const bff = (query: string, variables?: Record<string, unknown>) => bffRaw(query, variables, requestId);
  try {
    const body = await request.json().catch(() => ({ actions: [] }));
    const actions = Array.isArray(body.actions) ? body.actions : [];

    for (const action of actions) {
      if ('changePaymentState' in action) {
        // updateOrder returns a Json scalar, so it takes no selection set — the
        // old `{ id }` selection made GraphQL reject every call, and the error was
        // swallowed while this route still reported success (checkout showed
        // "Paid" but the order stayed Pending). Actions go in as a variable.
        try {
          await bff(
            `mutation ChangePaymentState($id: ID!, $actions: Json!) {
              updateOrder(id: $id, actions: $actions)
            }`,
            { id, actions: [{ changePaymentState: { paymentState: action.changePaymentState.paymentState } }] }
          );
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          log.warn("updateOrder changePaymentState failed", { reason });
          // Report the failure so the caller shows the real payment state.
          return NextResponse.json({ error: 'Could not update the payment state.' }, { status: 502 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error('error', err, { orderId: id });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
