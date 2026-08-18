import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { requestLogger } from '@/lib/request-logger';
import { bffJsonHeaders } from '@/lib/commerce-headers';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

const HEADERS = bffJsonHeaders();

// Only fields exposed by the BFF's Cart / CartLineItem schema.
const CART_FIELDS = `
  id version key customerId customerEmail createdAt lastModifiedAt cartState currencyCode
  shippingAddress {
    streetNumber streetName apartment building pOBox city state postalCode country phone mobile additionalStreetInfo additionalAddressInfo
  }
  billingAddress {
    streetNumber streetName apartment building pOBox city state postalCode country phone mobile additionalStreetInfo additionalAddressInfo
  }
  totalPrice { centAmount currencyCode fractionDigits }
  lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
`;

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

/** GET /api/carts/[id] — fetch a cart by id */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { log, requestId } = requestLogger(request, 'api/carts/[id]');
  const { id } = await params;
  try {
    const data = await bff(
      `query GetCart($id: ID!) {
        cart(id: $id) { ${CART_FIELDS} }
      }`,
      { id },
      requestId,
    );

    const cart = data?.cart;
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found.' }, { status: 404 });
    }
    return NextResponse.json(cart);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('get cart failed', err, { cartId: id });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
