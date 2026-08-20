import { NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";
import { requestLogger } from "@/lib/request-logger";
import { bffJsonHeaders } from "@/lib/commerce-headers";

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const HEADERS = bffJsonHeaders();

// Only fields exposed by the BFF's Cart / CartLineItem schema.
// CartLineItem: id, productId, sku, name, quantity, totalPrice
const CART_FIELDS = `
  id version key customerId customerEmail createdAt lastModifiedAt cartState currencyCode
  shippingAddress {
    streetNumber streetName apartment building pOBox city state postalCode country phone mobile additionalStreetInfo additionalAddressInfo
  }
  billingAddress {
    streetNumber streetName apartment building pOBox city state postalCode country phone mobile additionalStreetInfo additionalAddressInfo
  }
  totalPrice { centAmount currencyCode fractionDigits }
  shippingInfo { shippingMethodId shippingMethodName price { centAmount currencyCode fractionDigits } }
  discountCodes
  lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
`;

async function bff<T = unknown>(
  query: string,
  variables: Record<string, unknown> | undefined,
  requestId: string
): Promise<T> {
  const res = await projectScopedBffFetch(
    BFF_URL,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ query, variables })
    },
    requestId
  );
  if (!res.ok) throw new Error(`BFF HTTP ${res.status}`);
  const data = await res.json();
  if (data?.errors?.length)
    throw new Error(data.errors.map((e: { message: string }) => e.message).join("; "));
  return data?.data as T;
}

function getIntegerParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** POST /api/carts — create a new cart */
export async function POST(request: NextRequest) {
  const { log, requestId } = requestLogger(request, "api/carts");
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
      {
        currency: currency ?? "USD",
        customerId: customerId ?? null,
        customerEmail: customerEmail ?? null
      },
      requestId
    );

    const cart = data?.createB2bCart;
    if (!cart) {
      return NextResponse.json(
        { error: "Commerce backend returned no cart." },
        { status: 502 }
      );
    }
    return NextResponse.json(cart);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("create cart failed", err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** GET /api/carts — list carts, or search active carts when customerEmail is supplied */
export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, "api/carts");
  try {
    const url = new URL(request.url);
    const customerEmail = url.searchParams.get("customerEmail");

    if (customerEmail) {
      const data = await bff<{ searchCarts: { results: unknown[] } }>(
        `query SearchCarts($option: String!, $text: String!) {
          searchCarts(option: $option, text: $text) {
            results { ${CART_FIELDS} }
          }
        }`,
        { option: "customerEmail", text: customerEmail },
        requestId
      );

      const results = data?.searchCarts?.results ?? [];
      return NextResponse.json({ results });
    }

    const limit = getIntegerParam(url.searchParams.get("limit"), 20);
    const offset = getIntegerParam(url.searchParams.get("offset"), 0);
    const sortKey = url.searchParams.get("sortKey");
    const sortOrder = url.searchParams.get("sortOrder");

    const data = await bff<{
      cartPage: { results: unknown[]; total: number; count: number; offset: number };
    }>(
      `query CartPage($limit: Int!, $offset: Int!, $sortKey: String, $sortOrder: String) {
        cartPage(limit: $limit, offset: $offset, sortKey: $sortKey, sortOrder: $sortOrder) {
          total
          count
          offset
          results { ${CART_FIELDS} }
        }
      }`,
      {
        limit,
        offset,
        sortKey: sortKey || null,
        sortOrder: sortOrder || null
      },
      requestId
    );

    return NextResponse.json(
      data?.cartPage ?? { results: [], total: 0, count: 0, offset }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("fetch carts failed", err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
