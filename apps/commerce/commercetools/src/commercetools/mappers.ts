import type { Cart, CommerceLineItem, Customer, Money, Order, Product } from "@csa/commerce-contract";
import type { CtCart, CtCustomer, CtLineItem, CtMoney, CtOrder, CtProduct } from "./types.js";

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
    totalPrice: mapMoney(order.totalPrice)
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
