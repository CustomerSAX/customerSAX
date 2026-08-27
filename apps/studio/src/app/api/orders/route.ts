import { NextRequest, NextResponse } from 'next/server';
import { projectScopedBffFetch } from '@/lib/project-scoped-bff';
import { bffJsonHeaders } from '@/lib/commerce-headers';
import { requestLogger } from '@/lib/request-logger';

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? 'http://localhost:4000/graphql';

type Money = { centAmount?: number; currencyCode?: string; fractionDigits?: number };
type BffLineItem = {
  id?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  totalPrice?: Money;
};
type BffOrder = {
  id?: string;
  orderNumber?: string;
  customerId?: string;
  customerEmail?: string;
  state?: string;
  createdAt?: string;
  totalPrice?: Money;
  lineItems?: BffLineItem[];
};
type GraphqlError = { message?: string };
type GraphqlResponse<T> = { data?: T; errors?: GraphqlError[] };
type MappedOrder = ReturnType<typeof mapOrder>;
type BffResult = { ok: true; orders: MappedOrder[] } | { ok: false; reason: string };

function graphqlErrorMessage(errors: GraphqlError[]) {
  return errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
}

function mapOrder(ord: BffOrder) {
  const totalCentAmount = ord.totalPrice?.centAmount ?? 0;
  const val = (totalCentAmount / Math.pow(10, ord.totalPrice?.fractionDigits || 2)).toFixed(2);

  return {
    id: ord.id,
    orderNumber: ord.orderNumber || ord.id,
    customerId: ord.customerId || undefined,
    // customerName: CT orders don't carry a display name — use email as the
    // best available identifier (consistent with normalizeOrder in use-orders.ts).
    customerName: ord.customerEmail || ord.customerId || 'Guest',
    customerEmail: ord.customerEmail || '',
    createdAt: ord.createdAt || new Date().toISOString(),
    status: ord.state || 'Complete',
    totalPrice: `$${val}`,
    lineItems: Array.isArray(ord.lineItems)
      ? ord.lineItems.map((li) => ({
          id: li.id,
          name: li.name || 'Line Item',
          sku: li.sku || 'SKU',
          quantity: li.quantity || 1,
          price: li.totalPrice ? `$${((li.totalPrice.centAmount ?? 0) / Math.pow(10, li.totalPrice.fractionDigits || 2)).toFixed(2)}` : '$0.00',
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
async function queryBffOrder(orderNumber: string | null | undefined, customerId: string | null | undefined, requestId: string): Promise<BffResult> {
  if (orderNumber) {
    return queryBffOrderByNumber(orderNumber, requestId);
  }
  if (customerId) {
    return queryBffOrdersByCustomer(customerId, requestId);
  }
  return { ok: false, reason: 'No orderNumber or customerId provided' };
}

async function queryBffOrderByNumber(orderNumber: string, requestId: string): Promise<BffResult> {
  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: bffJsonHeaders(),
      body: JSON.stringify({
        query: `query GetOrder($orderNumber: String) {
          order(orderNumber: $orderNumber) {
            id orderNumber customerId customerEmail state createdAt
            totalPrice { centAmount currencyCode fractionDigits }
            lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
          }
        }`,
        variables: { orderNumber },
      }),
    }, requestId);
    if (!res.ok) return { ok: false, reason: `BFF returned HTTP ${res.status}` };
    const data = (await res.json()) as GraphqlResponse<{ order?: BffOrder | null }>;
    if (data.errors?.length) return { ok: false, reason: graphqlErrorMessage(data.errors) };
    const ord = data?.data?.order;

    // Real, reachable BFF says this order doesn't exist — that's a
    // legitimate empty result, not a failure.
    return { ok: true, orders: ord ? [mapOrder(ord)] : [] };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function queryBffOrdersByCustomer(customerId: string, requestId: string): Promise<BffResult> {
  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: 'POST',
      headers: bffJsonHeaders(),
      body: JSON.stringify({
        query: `query GetCustomerOrders($customerId: ID) {
          orderPage(customerId: $customerId, limit: 20, sortKey: "createdAt", sortOrder: "desc") {
            results {
              id orderNumber customerId customerEmail state createdAt
              totalPrice { centAmount currencyCode fractionDigits }
              lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
            }
          }
        }`,
        variables: { customerId },
      }),
    }, requestId);
    if (!res.ok) return { ok: false, reason: `BFF returned HTTP ${res.status}` };
    const data = (await res.json()) as GraphqlResponse<{ orderPage?: { results?: BffOrder[] } }>;
    if (data.errors?.length) return { ok: false, reason: graphqlErrorMessage(data.errors) };
    const results = data?.data?.orderPage?.results;
    if (!Array.isArray(results)) return { ok: false, reason: 'Malformed response from commerce backend' };

    return { ok: true, orders: results.map(mapOrder) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/orders');
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customerId');
  const orderNumber = url.searchParams.get('orderNumber');

  const bff = await queryBffOrder(orderNumber, customerId, requestId);

  if (!bff.ok) {
    log.error('commerce backend unavailable', undefined, { reason: bff.reason });
    return NextResponse.json(
      { error: 'Unable to reach the commerce backend right now.', orders: [], total: 0 },
      { status: 502 }
    );
  }

  return NextResponse.json({ orders: bff.orders, total: bff.orders.length });
}
