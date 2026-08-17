/**
 * Anti-corruption layer between commercetools' native GraphQL shapes (`Ct*`
 * types) and the platform-neutral contract types (`Product`, `Cart`, `Order`,
 * `Customer`, ...). This is where commercetools-specific quirks are absorbed so
 * they never leak past the adapter:
 *
 *   - localized fields (`nameAllLocales`, `descriptionAllLocales`) collapse to a
 *     single string via `firstLocalizedValue`;
 *   - names fall back to key -> id, SKU, etc. when the richer field is missing,
 *     honoring the no-mock-data rule (show a real lesser value, never invent
 *     a plausible placeholder — see .claude/rules/no-mock-data.md);
 *   - money keeps commercetools' `{ centAmount, currencyCode, fractionDigits }`
 *     minor-unit shape rather than a lossy float.
 *
 * Every subgraph for a different platform owns its own equivalent mapper; the
 * contract types are the fixed target all of them map into.
 */
import type { Cart, CommerceLineItem, Customer, Money, Order, OrderReturnInfo, Product } from "@csa/commerce-contract";
import type { CtCart, CtCustomer, CtLineItem, CtMoney, CtOrder, CtProduct, CtReturnInfo } from "./types.js";

export function mapProduct(product: CtProduct | null | undefined): Product | null {
  if (!product) {
    return null;
  }

  const current = product.masterData?.current;
  const variant = current?.masterVariant;

  return {
    description: firstLocalizedValue(current?.descriptionAllLocales),
    id: product.id,
    imageUrl: variant?.images?.[0]?.url,
    key: product.key,
    name: firstLocalizedValue(current?.nameAllLocales) ?? product.key ?? product.id,
    price: mapOptionalMoney(variant?.prices?.[0]?.value),
    sku: variant?.sku,
    slug: firstLocalizedValue(current?.slugAllLocales)
  };
}

export function mapCart(cart: CtCart | null | undefined): Cart | null {
  if (!cart) {
    return null;
  }

  return {
    currencyCode: cart.totalPrice.currencyCode,
    customerId: cart.customerId,
    id: cart.id,
    key: cart.key,
    lineItems: (cart.lineItems ?? []).map(mapLineItem),
    totalPrice: mapMoney(cart.totalPrice),
    version: cart.version
  };
}

export function mapOrder(order: CtOrder | null | undefined): Order | null {
  if (!order) {
    return null;
  }

  return {
    createdAt: order.createdAt,
    customerId: order.customerId,
    customerEmail: order.customerEmail,
    id: order.id,
    lastModifiedAt: order.lastModifiedAt,
    lineItems: (order.lineItems ?? []).map(mapLineItem),
    orderNumber: order.orderNumber,
    orderState: order.orderState,
    paymentState: order.paymentState,
    shipmentState: order.shipmentState,
    state: order.orderState,
    totalPrice: mapMoney(order.totalPrice),
    shippingAddress: order.shippingAddress ?? null,
    billingAddress: order.billingAddress ?? null,
    returnInfo: (order.returnInfo ?? []).map(mapReturnInfo),
  };
}

function mapReturnInfo(ri: CtReturnInfo): OrderReturnInfo {
  return {
    returnTrackingId: ri.returnTrackingId ?? null,
    returnDate: ri.returnDate ?? null,
    items: (ri.items ?? []).map((item) => ({
      id: item.id,
      type: item.type ?? null,
      quantity: item.quantity,
      lineItemId: item.lineItemId ?? null,
      shipmentState: item.shipmentState,
      paymentState: item.paymentState,
      comment: item.comment ?? null,
    })),
  };
}

export function mapCustomer(customer: CtCustomer | null | undefined): Customer | null {
  if (!customer) {
    return null;
  }

  return {
    companyName: customer.companyName,
    customerNumber: customer.customerNumber,
    customerGroup: customer.customerGroup,
    createdAt: customer.createdAt,
    email: customer.email,
    externalId: customer.externalId,
    firstName: customer.firstName,
    id: customer.id,
    key: customer.key,
    lastModifiedAt: customer.lastModifiedAt,
    lastName: customer.lastName,
    version: customer.version
  };
}

function mapLineItem(lineItem: CtLineItem): CommerceLineItem {
  return {
    id: lineItem.id,
    name: firstLocalizedValue(lineItem.nameAllLocales) ?? lineItem.variant?.sku ?? lineItem.id,
    productId: lineItem.productId,
    quantity: lineItem.quantity,
    sku: lineItem.variant?.sku,
    totalPrice: mapMoney(lineItem.totalPrice)
  };
}

function mapMoney(money: CtMoney): Money {
  return {
    centAmount: money.centAmount,
    currencyCode: money.currencyCode,
    fractionDigits: money.fractionDigits
  };
}

function mapOptionalMoney(money: CtMoney | undefined): Money | undefined {
  return money ? mapMoney(money) : undefined;
}

function firstLocalizedValue(values: Array<{ value: string }> | undefined) {
  return values?.[0]?.value;
}
