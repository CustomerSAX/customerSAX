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

/** POST /api/carts — create a new cart */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { currency, customerId, customerEmail } = body as {
      currency?: string;
      customerId?: string;
      customerEmail?: string;
    };

    const data = await bff(
      `mutation CreateCart($currency: String!, $customerId: ID, $customerEmail: String) {
        createB2bCart(currency: $currency, customerId: $customerId, customerEmail: $customerEmail) {
          id cartState country currency
          totalPrice { centAmount currencyCode fractionDigits }
          lineItems { id productId sku name quantity variant { sku }
            price { value { centAmount currencyCode fractionDigits } } }
        }
      }`,
      { currency: currency ?? 'USD', customerId: customerId ?? null, customerEmail: customerEmail ?? null },
    );

    const cart = data?.createB2bCart;
    if (!cart) {
      return NextResponse.json({ error: 'Commerce backend returned no cart.' }, { status: 502 });
    }
    return NextResponse.json(cart);
  } catch (err) {
    console.error('[POST /api/carts]', err);
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.' },
      { status: 502 },
    );
  }
}

/** GET /api/carts?customerEmail=… — search active carts for a customer */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const customerEmail = url.searchParams.get('customerEmail');
    if (!customerEmail) {
      return NextResponse.json({ error: 'customerEmail query param is required.' }, { status: 400 });
    }

    const data = await bff(
      `query SearchCarts($option: String!, $text: String!) {
        searchCarts(option: $option, text: $text) {
          results {
            id cartState country currency
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id productId sku name quantity variant { sku }
              price { value { centAmount currencyCode fractionDigits } } }
          }
        }
      }`,
      { option: 'customerEmail', text: customerEmail },
    );

    const results = data?.searchCarts?.results ?? [];
    const active = results.filter((c: { cartState?: string }) => c.cartState === 'Active');
    return NextResponse.json({ results: active });
  } catch (err) {
    console.error('[GET /api/carts]', err);
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.' },
      { status: 502 },
    );
  }
}
