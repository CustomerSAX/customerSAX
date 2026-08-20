import { NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";
import { requestLogger } from "@/lib/request-logger";
import { bffJsonHeaders } from "@/lib/commerce-headers";

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

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
  shippingInfo { shippingMethodId shippingMethodName price { centAmount currencyCode fractionDigits } }
  discountCodes
  lineItems { id productId sku name quantity totalPrice { centAmount currencyCode fractionDigits } }
`;

async function bffRaw(
  query: string,
  variables: Record<string, unknown> | undefined,
  requestId: string
) {
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
  | { setCustomerEmail: { email: string } }
  | { addDiscountCode: { code: string } };

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { log, requestId } = requestLogger(request, "api/carts/[id]/update");
  const { id } = await params;
  // Request-scoped wrapper so every bff() call forwards the correlation id.
  const bff = (query: string, variables?: Record<string, unknown>) =>
    bffRaw(query, variables, requestId);
  try {
    const body = (await request.json().catch(() => ({ actions: [] }))) as {
      actions: CartUpdateAction[];
    };
    const actions: CartUpdateAction[] = Array.isArray(body.actions) ? body.actions : [];

    // Fetch fresh cart line items for dynamic resolution if needed.
    const getFreshLineItems = async (): Promise<Array<{ id: string; sku?: string }>> => {
      try {
        const fresh = await bff(
          `query GetCartItems($id: ID!) {
            cart(id: $id) { lineItems { id sku } }
          }`,
          { id }
        );
        return (fresh?.cart?.lineItems ?? []) as Array<{ id: string; sku?: string }>;
      } catch {
        return [];
      }
    };

    // Execute each action sequentially (order matters for CT cart versioning).
    for (const action of actions) {
      if ("addLineItem" in action) {
        await bff(
          `mutation AddItem($id: ID!, $sku: String!, $quantity: Int!) {
            addCartLineItem(id: $id, sku: $sku, quantity: $quantity) { id }
          }`,
          { id, sku: action.addLineItem.sku, quantity: action.addLineItem.quantity }
        );
      } else if ("removeLineItem" in action) {
        let lineItemId = action.removeLineItem.lineItemId;
        const live = await getFreshLineItems();
        const match = live.find((i) => i.id === lineItemId) || live[0];
        if (match) lineItemId = match.id;
        await bff(
          `mutation RemoveItem($id: ID!, $lineItemId: ID!) {
            removeCartLineItem(id: $id, lineItemId: $lineItemId) { id }
          }`,
          { id, lineItemId }
        );
      } else if ("changeLineItemQuantity" in action) {
        let lineItemId = action.changeLineItemQuantity.lineItemId;
        const quantity = action.changeLineItemQuantity.quantity;
        const live = await getFreshLineItems();
        const match = live.find((i) => i.id === lineItemId) || live[0];
        if (match) lineItemId = match.id;

        if (quantity <= 0) {
          if (match) {
            await bff(
              `mutation RemoveItem($id: ID!, $lineItemId: ID!) {
                removeCartLineItem(id: $id, lineItemId: $lineItemId) { id }
              }`,
              { id, lineItemId }
            );
          }
        } else {
          try {
            await bff(
              `mutation ChangeQty($id: ID!, $lineItemId: ID!, $quantity: Int!) {
                changeCartLineItemQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) { id }
              }`,
              { id, lineItemId, quantity }
            );
          } catch (err) {
            // Safe fallback if primary mutation fails: remove + re-add via SKU
            if (match?.sku) {
              await bff(
                `mutation RemoveItem($id: ID!, $lineItemId: ID!) {
                  removeCartLineItem(id: $id, lineItemId: $lineItemId) { id }
                }`,
                { id, lineItemId }
              );
              await bff(
                `mutation AddItem($id: ID!, $sku: String!, $quantity: Int!) {
                  addCartLineItem(id: $id, sku: $sku, quantity: $quantity) { id }
                }`,
                { id, sku: match.sku, quantity }
              );
            } else {
              throw err;
            }
          }
        }
      } else if ("setShippingAddress" in action || "setBillingAddress" in action) {
        if ("setShippingAddress" in action) {
          await bff(
            `mutation SetShippingAddress($id: ID!, $address: Json!) {
              updateCartAddresses(id: $id, shippingAddress: $address) { id }
            }`,
            { id, address: action.setShippingAddress.address }
          );
        } else {
          await bff(
            `mutation SetBillingAddress($id: ID!, $address: Json!) {
              updateCartAddresses(id: $id, billingAddress: $address) { id }
            }`,
            { id, address: action.setBillingAddress.address }
          );
        }
      } else if ("setShippingMethod" in action) {
        const smId = action.setShippingMethod.shippingMethod.id;
        await bff(
          `mutation SetShipping($id: ID!, $shippingMethodId: ID!) {
            setCartShippingMethod(id: $id, shippingMethodId: $shippingMethodId) { id }
          }`,
          { id, shippingMethodId: smId }
        );
      } else if ("addDiscountCode" in action) {
        await bff(
          `mutation AddDiscount($id: ID!, $code: String!) { addCartDiscountCode(id: $id, code: $code) { id } }`,
          { id, code: action.addDiscountCode.code }
        );
      } else if ("setCustomerId" in action || "setCustomerEmail" in action) {
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
      { id }
    );

    return NextResponse.json(cartData?.cart ?? { id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("cart update failed", err, { cartId: id });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
