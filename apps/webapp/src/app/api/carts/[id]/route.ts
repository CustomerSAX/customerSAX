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

/** GET /api/carts/[id] — fetch a cart by id */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await bff(
      `query GetCart($id: ID!) {
        cart(id: $id) {
          id cartState country currency
          customerId customerEmail
          shippingAddress { firstName lastName streetName streetNumber city state region postalCode country }
          totalPrice { centAmount currencyCode fractionDigits }
          lineItems { id productId sku name quantity variant { sku }
            price { value { centAmount currencyCode fractionDigits } }
            totalPrice { centAmount currencyCode fractionDigits } }
        }
      }`,
      { id },
    );

    const cart = data?.cart;
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found.' }, { status: 404 });
    }
    return NextResponse.json(cart);
  } catch (err) {
    console.error(`[GET /api/carts/${id}]`, err);
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.' },
      { status: 502 },
    );
  }
}
