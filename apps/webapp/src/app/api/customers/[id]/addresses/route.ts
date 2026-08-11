import { NextRequest, NextResponse } from 'next/server';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

const HEADERS = {
  'content-type': 'application/json',
  'x-csa-commerce-platform': 'commercetools',
};

async function bff(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(BFF_URL, {
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

/** GET /api/customers/[id]/addresses — fetch a customer's saved addresses */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await bff(
      `query CustomerAddresses($id: ID!) {
        customerAddresses(id: $id) {
          id key firstName lastName streetName streetNumber
          additionalStreetInfo city region state postalCode country
        }
      }`,
      { id },
    );

    const addresses = data?.customerAddresses ?? [];
    return NextResponse.json({ addresses });
  } catch (err) {
    console.error(`[GET /api/customers/${id}/addresses]`, err);
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.', addresses: [] },
      { status: 502 },
    );
  }
}
