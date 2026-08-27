import { createLogger } from "@csa/logger";
import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { getOrderById, getOrderByNumber, listOrders } from "../../../commercetools/api/index.js";
import { mapOrder } from "./order.mapper.js";
import type { CtOrder } from "../../../commercetools/types.js";
import { compactWhere, escapeWhere, page, paging, sort, type PagingArgs } from "../shared/paging.js";
import type { OrderSearchArgs } from "./order.types.js";

const log = createLogger("commercetools").child({ module: "order.resolvers" });

// Fields requested from the CT GraphQL API for every order query. This local
// constant takes precedence over the importable orderFields in orderFields.ts
// (which are used by other callers). Keep them in sync if either changes.
// customerEmail / shipmentState / paymentState were previously missing here,
// causing those fields to always come back null despite being in the contract.
const orderFields = `#graphql
  id
  orderNumber
  customerId
  customerEmail
  orderState
  shipmentState
  paymentState
  createdAt
  totalPrice { centAmount currencyCode fractionDigits }
  lineItems { id productId variant { sku } nameAllLocales { value } quantity totalPrice { centAmount currencyCode fractionDigits } }
  shippingAddress { streetName streetNumber city state postalCode country }
  billingAddress  { streetName streetNumber city state postalCode country }
  returnInfo {
    returnTrackingId
    returnDate
    items {
      id
      type
      quantity
      shipmentState
      paymentState
      comment
      ... on LineItemReturnItem { lineItemId }
    }
  }
`;

export const resolvers = {
  order: (_parent: unknown, args: { id?: string; orderNumber?: string }) =>
    args.orderNumber ? getOrderByNumber(args.orderNumber) : args.id ? getOrderById(args.id) : null,
  orders: async (_parent: unknown, args: PagingArgs) => {
    const orderPage = await listOrders(args);

    return orderPage.results;
  },
  orderPage: async (_parent: unknown, args: OrderSearchArgs) => queryOrders(orderListWhere(args), args),
  b2bOrders: async (_parent: unknown, args: OrderSearchArgs) =>
    queryOrders(
      compactWhere([
        args.customerId ? `customerId="${escapeWhere(args.customerId)}"` : undefined,
        args.businessUnitKey
          ? `businessUnit(key="${escapeWhere(args.businessUnitKey)}")`
          : undefined
      ]),
      args
    ),
  searchOrders: async (_parent: unknown, args: OrderSearchArgs) => {
    const result = await queryOrders(orderSearchWhere(args), args);

    return {
      ids: result.results.map((order) => order.id),
      total: result.total
    };
  },
  orderPayments: (_parent: unknown, args: { id: string }) =>
    commercetoolsGraphql(
      `#graphql
        query OrderPayments($id: String!) {
          order(id: $id) {
            id
            customerId
            paymentInfo {
              payments {
                id
                amountPlanned { centAmount currencyCode fractionDigits }
                paymentMethodInfo { method name(locale: "en-US") }
                transactions { id timestamp type state amount { centAmount currencyCode fractionDigits } }
              }
            }
          }
        }
      `,
      { id: args.id }
    ),
  orderReturns: (_parent: unknown, args: { id: string }) =>
    commercetoolsGraphql(
      `#graphql
        query OrderReturns($id: String!) {
          order(id: $id) {
            id
            orderNumber
            lineItems { id productId variant { sku } nameAllLocales { value } quantity }
            returnInfo {
              returnTrackingId
              returnDate
              items {
                id
                type
                quantity
                shipmentState
                paymentState
                comment
                ... on LineItemReturnItem { lineItemId }
              }
            }
          }
        }
      `,
      { id: args.id }
    ),
  orderCount: async (_parent: unknown, args: { customerId: string; states?: string[] }) => {
    const stateWhere = args.states?.length
      ? `(${args.states.map((state) => `orderState="${escapeWhere(state)}"`).join(" or ")})`
      : undefined;
    const data = await commercetoolsGraphql<{ orders: { total?: number } }>(
      `#graphql
        query OrderCount($where: String!) {
          orders(where: $where, limit: 1) { total }
        }
      `,
      { where: compactWhere([`customerId="${escapeWhere(args.customerId)}"`, stateWhere]) }
    );

    return data.orders.total ?? 0;
  },
  updateOrder: async (_parent: unknown, args: { actions: unknown[]; id: string }) => {
    const order = await getOrderVersion(args.id);
    // Action NAMES only (e.g. changeOrderState, addReturnInfo) — never the
    // params, which can carry customer comments/PII.
    const actions = (args.actions ?? [])
      .flatMap((action) => (action && typeof action === "object" ? Object.keys(action) : []));

    try {
      const result = await commercetoolsGraphql(
        `#graphql
          mutation UpdateOrder($id: String!, $version: Long!, $actions: [OrderUpdateAction!]!) {
            updateOrder(id: $id, version: $version, actions: $actions) {
              id orderNumber orderState version
            }
          }
        `,
        { actions: args.actions, id: args.id, version: order.version }
      );
      log.info("ct:updateOrder", { id: args.id, actions, ok: true });
      return result;
    } catch (err) {
      log.info("ct:updateOrder", { id: args.id, actions, ok: false });
      throw err;
    }
  },
  replicateOrder: (_parent: unknown, args: { id: string }) =>
    commercetoolsGraphql(
      `#graphql
        mutation ReplicateOrder($reference: OrderReferenceInput!) {
          replicateCart(reference: $reference) {
            id
            key
            customerId
            totalPrice { centAmount currencyCode fractionDigits }
          }
        }
      `,
      { reference: { id: args.id, typeId: "order" } }
    )
};

async function queryOrders(where: string | undefined, args: PagingArgs) {
  const { limit, offset } = paging(args);
  const data = await commercetoolsGraphql<{ orders: { results: CtOrder[]; total?: number } }>(
    `#graphql
      query OrdersPage($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
        orders(limit: $limit, offset: $offset, sort: $sort, where: $where) {
          total
          results { ${orderFields} }
        }
      }
    `,
    { limit, offset, sort: sort(args), where }
  );

  return page(data.orders.results.map(mapOrder).filter(isDefined), data.orders.total, offset);
}

function orderListWhere(args: OrderSearchArgs) {
  return compactWhere([
    args.customerId ? `customerId="${escapeWhere(args.customerId)}"` : undefined,
    args.customerEmail ? `customerEmail="${escapeWhere(args.customerEmail)}"` : undefined,
    args.orderRef ? `orderNumber="${escapeWhere(args.orderRef)}" or id="${escapeWhere(args.orderRef)}"` : undefined
  ]);
}

function orderSearchWhere(args: OrderSearchArgs) {
  const text = escapeWhere(args.text?.trim() ?? "");

  if (!text) {
    return `id=""`;
  }

  switch (args.option) {
    case "customerEmail":
      return `customerEmail="${text}"`;
    case "orderNumber":
      return `orderNumber="${text}"`;
    case "id":
      return `id="${text}"`;
    default:
      return `orderNumber="${text}" or id="${text}" or customerEmail="${text}"`;
  }
}

async function getOrderVersion(id: string) {
  const data = await commercetoolsGraphql<{ order: { version: number } | null }>(
    `#graphql
      query OrderVersion($id: String!) { order(id: $id) { version } }
    `,
    { id }
  );

  if (!data.order) {
    throw new Error("Order not found.");
  }

  return data.order;
}

function isDefined<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}
