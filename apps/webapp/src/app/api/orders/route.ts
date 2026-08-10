import { NextRequest, NextResponse } from 'next/server';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

type BffResult = { ok: true; orders: any[] } | { ok: false; reason: string };

function mapOrder(ord: any) {
  const val = ord.totalPrice ? (ord.totalPrice.centAmount / Math.pow(10, ord.totalPrice.fractionDigits || 2)).toFixed(2) : '0.00';

  return {
    id: ord.id,
    orderNumber: ord.orderNumber || ord.id,
    customerId: ord.customerId || 'cust-1',
    customerName: 'Customer',
    customerEmail: '',
    createdAt: ord.createdAt || new Date().toISOString(),
    status: ord.state || 'Complete',
    totalPrice: `$${val}`,
    lineItems: Array.isArray(ord.lineItems)
      ? ord.lineItems.map((li: any) => ({
          id: li.id,
          name: li.name || 'Line Item',
          sku: li.sku || 'SKU',
          quantity: li.quantity || 1,
          price: li.totalPrice ? `$${(li.totalPrice.centAmount / Math.pow(10, li.totalPrice.fractionDigits || 2)).toFixed(2)}` : '$45.00',
          image: 'https://images.unsplash.com/photo-1585336261026-6757c54e3ed7?w=150',
        }))
      : [],
  };
}

// No mock data here. `ok` distinguishes "BFF reachable, order genuinely
// doesn't exist" (real empty result, returned as-is) from
// "BFF unreachable/erroring" (a real failure, reported as an error).
//
// NOTE: the singular `order(id, orderNumber)` field has no `customerId`
// argument at all — the old code passed `id: customerId ? undefined : ...`,
// which meant a customerId-only lookup always sent `order(id: undefined,
// orderNumber: undefined)` and could never return a real result. Listing a
// customer's orders has to go through `orderPage(customerId: ...)` instead.
async function queryBffOrder(orderNumber?: string | null, customerId?: string | null): Promise<BffResult> {
  if (orderNumber) {
    return queryBffOrderByNumber(orderNumber);
  }
  if (customerId) {
    return queryBffOrdersByCustomer(customerId);
  }
  return { ok: false, reason: 'No orderNumber or customerId provided' };
}

async function queryBffOrderByNumber(orderNumber: string): Promise<BffResult> {
  try {
    const res = await fetch(BFF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csa-commerce-platform': 'commercetools' },
      body: JSON.stringify({
        query: `query GetOrder($orderNumber: String) {
          order(orderNumber: $orderNumber) {
            id orderNumber customerId state createdAt
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
          }
        }`,
        variables: { orderNumber },
      }),
    });
    if (!res.ok) return { ok: false, reason: `BFF returned HTTP ${res.status}` };
    const data = await res.json();
    if (data?.errors?.length) return { ok: false, reason: data.errors.map((e: any) => e.message).join('; ') };
    const ord = data?.data?.order;

    // Real, reachable BFF says this order doesn't exist — that's a
    // legitimate empty result, not a failure.
    return { ok: true, orders: ord ? [mapOrder(ord)] : [] };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function queryBffOrdersByCustomer(customerId: string): Promise<BffResult> {
  try {
    const res = await fetch(BFF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csa-commerce-platform': 'commercetools' },
      body: JSON.stringify({
        query: `query GetCustomerOrders($customerId: ID) {
          orderPage(customerId: $customerId, limit: 20, sortKey: "createdAt", sortOrder: "desc") {
            results {
              id orderNumber customerId state createdAt
              totalPrice { centAmount currencyCode fractionDigits }
              lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
            }
          }
        }`,
        variables: { customerId },
      }),
    });
    if (!res.ok) return { ok: false, reason: `BFF returned HTTP ${res.status}` };
    const data = await res.json();
    if (data?.errors?.length) return { ok: false, reason: data.errors.map((e: any) => e.message).join('; ') };
    const results = data?.data?.orderPage?.results;
    if (!Array.isArray(results)) return { ok: false, reason: 'Malformed response from commerce backend' };

    return { ok: true, orders: results.map(mapOrder) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customerId');
  const orderNumber = url.searchParams.get('orderNumber');

  const bff = await queryBffOrder(orderNumber, customerId);

  if (!bff.ok) {
    console.error(`[orders] commerce backend unavailable: ${bff.reason}`);
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.', orders: [], total: 0 },
      { status: 502 }
    );
  }

  return NextResponse.json({ orders: bff.orders, total: bff.orders.length });
}
