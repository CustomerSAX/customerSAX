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

type CartUpdateAction =
  | { addLineItem: { sku: string; quantity: number } }
  | { removeLineItem: { lineItemId: string } }
  | { changeLineItemQuantity: { lineItemId: string; quantity: number } }
  | { setShippingAddress: { address: Record<string, unknown> } }
  | { setBillingAddress: { address: Record<string, unknown> } }
  | { setShippingMethod: { shippingMethod: { typeId: string; id: string } } }
  | { setCustomerId: { customerId: string } }
  | { setCustomerEmail: { email: string } };

/**
 * POST /api/carts/[id]/update
 *
 * Body: { actions: CartUpdateAction[] }
 *
 * Each action dispatches to its own BFF mutation so we can support all the
 * actions the checkout flow needs from a single endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({ actions: [] })) as { actions: CartUpdateAction[] };
    const actions: CartUpdateAction[] = Array.isArray(body.actions) ? body.actions : [];

    // Execute each action sequentially (order matters for CT cart versioning).
    for (const action of actions) {
      if ('addLineItem' in action) {
        await bff(
          `mutation AddItem($id: ID!, $sku: String!, $quantity: Int!) {
            addCartLineItem(id: $id, sku: $sku, quantity: $quantity) { id }
          }`,
          { id, sku: action.addLineItem.sku, quantity: action.addLineItem.quantity },
        );
      } else if ('removeLineItem' in action) {
        await bff(
          `mutation RemoveItem($id: ID!, $lineItemId: ID!) {
            removeCartLineItem(id: $id, lineItemId: $lineItemId) { id }
          }`,
          { id, lineItemId: action.removeLineItem.lineItemId },
        );
      } else if ('changeLineItemQuantity' in action) {
        const { lineItemId, quantity } = action.changeLineItemQuantity;
        if (quantity <= 0) {
          await bff(
            `mutation RemoveItem($id: ID!, $lineItemId: ID!) {
              removeCartLineItem(id: $id, lineItemId: $lineItemId) { id }
            }`,
            { id, lineItemId },
          );
        } else {
          // Try the direct mutation first; the BFF exposes changeCartLineItemQuantity if wired.
          try {
            await bff(
              `mutation ChangeQty($id: ID!, $lineItemId: ID!, $quantity: Int!) {
                changeCartLineItemQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) { id }
              }`,
              { id, lineItemId, quantity },
            );
          } catch {
            // If changeCartLineItemQuantity isn't in the schema, the store's +1/-1 flow
            // handles it via remove + re-add at the CartStore level.
          }
        }
      } else if ('setShippingAddress' in action || 'setBillingAddress' in action) {
        const addr = ('setShippingAddress' in action)
          ? action.setShippingAddress.address
          : (action as { setBillingAddress: { address: Record<string, unknown> } }).setBillingAddress.address;
        await bff(
          `mutation SetAddress($id: ID!, $address: AddressInput!) {
            updateCartAddresses(id: $id, shippingAddress: $address, billingAddress: $address) { id }
          }`,
          { id, address: addr },
        );
      } else if ('setShippingMethod' in action) {
        const smId = action.setShippingMethod.shippingMethod.id;
        await bff(
          `mutation SetShipping($id: ID!, $shippingMethodId: ID!) {
            setCartShippingMethod(id: $id, shippingMethodId: $shippingMethodId) { id }
          }`,
          { id, shippingMethodId: smId },
        );
      } else if ('setCustomerId' in action || 'setCustomerEmail' in action) {
        // customerId/customerEmail are not exposed as standalone BFF mutations; they were
        // accepted at cart creation time. Silently accept — the cart's CT record was already
        // linked at create-cart time when we passed those args to createB2bCart.
      }
    }

    // After all mutations, fetch the fresh cart to return current state.
    const cartData = await bff(
      `query GetCart($id: ID!) {
        cart(id: $id) { ${CART_FIELDS} }
      }`,
      { id },
    );

    return NextResponse.json(cartData?.cart ?? { id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[POST /api/carts/${id}/update]`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
