import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { requestLogger } from '@/lib/request-logger';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

const HEADERS = {
  'content-type': 'application/json',
  'x-csa-commerce-platform': 'commercetools',
};

// Only fields exposed by the BFF's Cart / CartLineItem schema.
// Cart: id, version, key, customerId, currencyCode, totalPrice, lineItems
// CartLineItem: id, productId, sku, name, quantity, totalPrice
const CART_FIELDS = `
  id version key customerId currencyCode
  totalPrice { centAmount currencyCode fractionDigits }
  lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
`;

async function bff<T = unknown>(query: string, variables: Record<string, unknown> | undefined, requestId: string): Promise<T> {
  const res = await projectScopedBffFetch(BFF_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  }, requestId);
  if (!res.ok) throw new Error(`BFF HTTP ${res.status}`);
  const data = await res.json();
  if (data?.errors?.length)
    throw new Error(data.errors.map((e: { message: string }) => e.message).join('; '));
  return data?.data as T;
}

/** POST /api/carts — create a new cart */
export async function POST(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/carts');
  try {
    const body = await request.json().catch(() => ({}));
    const { currency, customerId, customerEmail } = body as {
      currency?: string;
      customerId?: string;
      customerEmail?: string;
    };

    const data = await bff<{ createB2bCart: unknown }>(
      `mutation CreateCart($currency: String!, $customerId: ID, $customerEmail: String) {
        createB2bCart(currency: $currency, customerId: $customerId, customerEmail: $customerEmail) {
          ${CART_FIELDS}
        }
      }`,
      { currency: currency ?? 'USD', customerId: customerId ?? null, customerEmail: customerEmail ?? null },
      requestId,
    );

    const cart = data?.createB2bCart;
    if (!cart) {
      return NextResponse.json({ error: 'Commerce backend returned no cart.' }, { status: 502 });
    }
    return NextResponse.json(cart);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('create cart failed', err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** GET /api/carts?customerEmail=… — search active carts for a customer */
export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/carts');
  try {
    const url = new URL(request.url);
    const customerEmail = url.searchParams.get('customerEmail');
    if (!customerEmail) {
      return NextResponse.json({ error: 'customerEmail query param is required.' }, { status: 400 });
    }

    const data = await bff<{ searchCarts: { results: unknown[] } }>(
      `query SearchCarts($option: String!, $text: String!) {
        searchCarts(option: $option, text: $text) {
          results { ${CART_FIELDS} }
        }
      }`,
      { option: 'customerEmail', text: customerEmail },
      requestId,
    );

    const results = data?.searchCarts?.results ?? [];
    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('search carts failed', err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
