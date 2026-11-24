import { createHash } from "node:crypto";
import { createLogger } from "@csa/logger";
import { commercetoolsGraphql } from "../../../commercetools/client.js";

const log = createLogger("commercetools").child({ module: "order-replacement" });

type ReplacementInput = {
  orderId: string;
  returnItemId: string;
  replacementSku: string;
  quantity: number;
  reason?: string;
  note?: string;
};

type Address = Record<string, string | null | undefined>;

type ReplacementOrder = {
  id: string;
  orderNumber?: string | null;
  purchaseOrderNumber?: string | null;
  lineItems?: Array<{ quantity: number; variant?: { sku?: string | null } | null }>;
};

type ReplacementCart = {
  id: string;
  version: number;
  cartState: string;
  lineItems?: Array<{ quantity: number; variant?: { sku?: string | null } | null }>;
};

type OriginalOrder = {
  id: string;
  orderNumber?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  totalPrice: { currencyCode: string };
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  lineItems: Array<{
    id: string;
    quantity: number;
    variant?: { sku?: string | null } | null;
  }>;
  returnInfo?: Array<{
    items: Array<{
      id: string;
      lineItemId?: string | null;
      quantity: number;
      shipmentState: string;
    }>;
  }> | null;
};

const addressFields = `#graphql
  key title salutation firstName lastName company
  streetName streetNumber additionalStreetInfo apartment building pOBox
  postalCode city region state country additionalAddressInfo
  phone mobile email
`;

export const replacementReference = (orderId: string, returnItemId: string) =>
  `CSA-RPL:${orderId}:${returnItemId}`;

export const replacementCartKey = (reference: string) =>
  `csa-rpl-${createHash("sha256").update(reference).digest("hex").slice(0, 32)}`;

export function assertMatchingReplacement(
  resource: ReplacementOrder | ReplacementCart,
  replacementSku: string,
  quantity: number
) {
  const lineItems = resource.lineItems ?? [];
  const matches =
    lineItems.length === 1 &&
    lineItems[0]?.variant?.sku === replacementSku &&
    lineItems[0]?.quantity === quantity;
  if (!matches) {
    throw new Error(
      "A replacement already exists for this returned item with a different SKU or quantity."
    );
  }
}

function compactAddress(address: Address | null | undefined) {
  if (!address) return undefined;
  return Object.fromEntries(
    Object.entries(address).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0
    )
  );
}

function replacementOrderNumber(originalOrder: OriginalOrder, reference: string) {
  const source = (originalOrder.orderNumber ?? originalOrder.id)
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 70);
  const suffix = createHash("sha256").update(reference).digest("hex").slice(0, 8);
  return `RPL-${source}-${suffix}`;
}

export async function createReplacementOrder(input: ReplacementInput) {
  const reference = replacementReference(input.orderId, input.returnItemId);
  const cartKey = replacementCartKey(reference);
  const context = await commercetoolsGraphql<{
    order?: OriginalOrder | null;
    replacements: { results?: ReplacementOrder[] };
    carts: { results?: ReplacementCart[] };
  }>(
    `#graphql
      query ReplacementOrderContext(
        $orderId: String!
        $replacementWhere: String!
        $cartWhere: String!
      ) {
        order(id: $orderId) {
          id orderNumber customerId customerEmail
          totalPrice { currencyCode }
          shippingAddress { ${addressFields} }
          billingAddress { ${addressFields} }
          lineItems { id quantity variant { sku } }
          returnInfo {
            items {
              id quantity shipmentState
              ... on LineItemReturnItem { lineItemId }
            }
          }
        }
        replacements: orders(where: $replacementWhere, limit: 2) {
          results {
            id orderNumber purchaseOrderNumber
            lineItems { quantity variant { sku } }
          }
        }
        carts(where: $cartWhere, limit: 1) {
          results {
            id version cartState
            lineItems { quantity variant { sku } }
          }
        }
      }
    `,
    {
      orderId: input.orderId,
      replacementWhere: `purchaseOrderNumber=\"${reference}\"`,
      cartWhere: `key=\"${cartKey}\"`
    }
  );

  const originalOrder = context.order;
  if (!originalOrder) throw new Error(`Order '${input.orderId}' was not found.`);

  const returnItem = (originalOrder.returnInfo ?? [])
    .flatMap((entry) => entry.items)
    .find((item) => item.id === input.returnItemId);
  if (!returnItem) {
    throw new Error("The selected return item is no longer present on the order.");
  }
  if (returnItem.shipmentState !== "Returned") {
    throw new Error("Only items marked as returned can be replaced.");
  }
  if (!returnItem.lineItemId) {
    throw new Error("Custom line-item returns cannot be replaced by SKU.");
  }
  if (!originalOrder.lineItems.some((item) => item.id === returnItem.lineItemId)) {
    throw new Error("The original line item for this return could not be found.");
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new Error("Replacement quantity must be a positive whole number.");
  }
  if (input.quantity > returnItem.quantity) {
    throw new Error("Replacement quantity exceeds the returned quantity.");
  }
  const shippingAddress = compactAddress(originalOrder.shippingAddress);
  if (!shippingAddress?.country) {
    throw new Error("The original order does not have a usable shipping address.");
  }

  const existingOrder = context.replacements.results?.[0];
  if (existingOrder) {
    assertMatchingReplacement(existingOrder, input.replacementSku, input.quantity);
    return {
      status: "existing",
      reference,
      originalOrderId: originalOrder.id,
      originalOrderNumber: originalOrder.orderNumber ?? null,
      returnItemId: input.returnItemId,
      replacementOrderId: existingOrder.id,
      replacementOrderNumber: existingOrder.orderNumber ?? null,
      replacementSku: input.replacementSku,
      quantity: input.quantity
    };
  }

  let cart = context.carts.results?.[0];
  if (cart) {
    if (cart.cartState !== "Active") {
      throw new Error("The existing replacement cart is no longer active; retry the request.");
    }
    assertMatchingReplacement(cart, input.replacementSku, input.quantity);
  } else {
    const created = await commercetoolsGraphql<{ createCart?: ReplacementCart | null }>(
      `#graphql
        mutation CreateReplacementCart($draft: CartDraft!) {
          createCart(draft: $draft) {
            id version cartState
            lineItems { quantity variant { sku } }
          }
        }
      `,
      {
        draft: {
          key: cartKey,
          currency: originalOrder.totalPrice.currencyCode,
          country: shippingAddress.country,
          customerId: originalOrder.customerId || undefined,
          customerEmail: originalOrder.customerEmail || undefined,
          shippingAddress,
          billingAddress: compactAddress(originalOrder.billingAddress),
          purchaseOrderNumber: reference,
          inventoryMode: "TrackOnly",
          lineItems: [
            {
              sku: input.replacementSku,
              quantity: input.quantity,
              externalPrice: {
                centPrecision: {
                  centAmount: 0,
                  currencyCode: originalOrder.totalPrice.currencyCode
                }
              }
            }
          ]
        }
      }
    );
    cart = created.createCart ?? undefined;
    if (!cart) throw new Error("commercetools did not create the replacement cart.");
  }

  const createdOrder = await commercetoolsGraphql<{
    createOrderFromCart?: ReplacementOrder | null;
  }>(
    `#graphql
      mutation PlaceReplacementOrder($draft: OrderCartCommand!) {
        createOrderFromCart(draft: $draft) {
          id orderNumber purchaseOrderNumber
          lineItems { quantity variant { sku } }
        }
      }
    `,
    {
      draft: {
        id: cart.id,
        version: cart.version,
        orderNumber: replacementOrderNumber(originalOrder, reference),
        paymentState: "Paid",
        shipmentState: "Pending"
      }
    }
  );
  const replacementOrder = createdOrder.createOrderFromCart;
  if (!replacementOrder) {
    throw new Error("commercetools did not create the replacement order.");
  }

  log.info("ct:createReplacementOrder", {
    originalOrderId: originalOrder.id,
    replacementOrderId: replacementOrder.id,
    returnItemId: input.returnItemId,
    replacementSku: input.replacementSku,
    quantity: input.quantity,
    reason: input.reason,
    hasNote: Boolean(input.note),
    ok: true
  });

  return {
    status: "created",
    reference,
    originalOrderId: originalOrder.id,
    originalOrderNumber: originalOrder.orderNumber ?? null,
    returnItemId: input.returnItemId,
    replacementOrderId: replacementOrder.id,
    replacementOrderNumber: replacementOrder.orderNumber ?? null,
    replacementSku: input.replacementSku,
    quantity: input.quantity
  };
}
