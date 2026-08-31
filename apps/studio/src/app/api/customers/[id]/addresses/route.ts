import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { requestLogger } from '@/lib/request-logger';
import { bffJsonHeaders } from '@/lib/commerce-headers';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

const HEADERS = bffJsonHeaders();

async function bff(query: string, variables: Record<string, unknown> | undefined, requestId: string) {
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

/** GET /api/customers/[id]/addresses — fetch a customer's saved addresses */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { log, requestId } = requestLogger(request, 'api/customers/[id]/addresses');
  const { id } = await params;
  try {
    const data = await bff(
      `query CustomerAddresses($id: ID!) {
        customerAddresses(id: $id)
      }`,
      { id },
      requestId,
    );

    // customerAddresses resolver returns { addresses: [...], defaultShippingAddressId, ... }
    // — not a bare array. Drill into .addresses so the store gets the right shape.
    const customerData = data?.customerAddresses as {
      addresses?: unknown[];
      defaultBillingAddressId?: string | null;
      defaultShippingAddressId?: string | null;
      billingAddressIds?: string[];
      shippingAddressIds?: string[];
    } | null | undefined;
    const addresses = customerData?.addresses ?? [];
    return NextResponse.json({
      addresses,
      defaultBillingAddressId: customerData?.defaultBillingAddressId ?? null,
      defaultShippingAddressId: customerData?.defaultShippingAddressId ?? null,
      billingAddressIds: customerData?.billingAddressIds ?? [],
      shippingAddressIds: customerData?.shippingAddressIds ?? [],
    });
  } catch (err) {
    log.error('failed to fetch customer addresses', err, { customerId: id });
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.', addresses: [] },
      { status: 502 },
    );
  }
}
