import { NextRequest, NextResponse } from 'next/server';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

const HEADERS = {
  'content-type': 'application/json',
  'x-csa-commerce-platform': 'commercetools',
};

// Only fields exposed by the BFF's Cart / CartLineItem schema.
const CART_FIELDS = `
  id version key customerId currencyCode
  totalPrice { centAmount currencyCode fractionDigits }
  lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
`;

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
        cart(id: $id) { ${CART_FIELDS} }
      }`,
      { id },
    );

    const cart = data?.cart;
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found.' }, { status: 404 });
    }
    return NextResponse.json(cart);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[GET /api/carts/${id}]`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
