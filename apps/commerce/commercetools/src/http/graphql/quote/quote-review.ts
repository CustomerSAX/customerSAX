import { commercetoolsGraphql, escapeWhere } from "../../../commercetools/client.js";

type Money = { centAmount: number; currencyCode: string; fractionDigits: number };
type SnapshotResponse = {
  quoteRequest?: {
    id: string;
    key?: string | null;
    version: number;
    quoteRequestState?: string | null;
    comment?: string | null;
    createdAt?: string;
    lastModifiedAt?: string;
    totalPrice?: Money | null;
    businessUnit?: { key?: string | null; name?: string | null } | null;
    customer?: {
      id: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
    shippingAddress?: Record<string, string | null> | null;
    billingAddress?: Record<string, string | null> | null;
    lineItems?: Array<{
      id: string;
      quantity: number;
      variant?: { sku?: string | null } | null;
      nameAllLocales?: Array<{ value?: string | null }> | null;
      price?: { value?: Money | null } | null;
      totalPrice?: Money | null;
    }> | null;
  } | null;
};
type InventoryResponse = {
  inventoryEntries: {
    results: Array<{
      sku: string;
      availableQuantity: number;
      supplyChannel?: { key?: string | null } | null;
    }>;
  };
};
type StateResponse = {
  quoteRequest?: { version: number; quoteRequestState?: string | null } | null;
};
type UpdateResponse = {
  updateQuoteRequest: { id: string; version: number; quoteRequestState?: string | null };
};

const ADDRESS_FIELDS = `streetNumber streetName apartment building city state postalCode country phone mobile company`;
const SNAPSHOT_QUERY = /* GraphQL */ `
  query QuoteReviewSnapshot($id: String!) {
    quoteRequest(id: $id) {
      id
      key
      version
      quoteRequestState
      comment
      createdAt
      lastModifiedAt
      totalPrice { centAmount currencyCode fractionDigits }
      businessUnit { key name }
      customer { id email firstName lastName }
      shippingAddress { ${ADDRESS_FIELDS} }
      billingAddress { ${ADDRESS_FIELDS} }
      lineItems {
        id
        quantity
        variant { sku }
        nameAllLocales { value }
        price { value { centAmount currencyCode fractionDigits } }
        totalPrice { centAmount currencyCode fractionDigits }
      }
    }
  }
`;

/** Current quote request facts for AI review. Missing values stay null; nothing is defaulted. */
export async function quoteReviewSnapshot(id: string) {
  const data = await commercetoolsGraphql<SnapshotResponse>(SNAPSHOT_QUERY, { id });
  const quote = data.quoteRequest;
  if (!quote) return null;
  const lineItems = (quote.lineItems ?? []).map((item) => ({
    id: item.id,
    sku: item.variant?.sku ?? null,
    name: item.nameAllLocales?.[0]?.value ?? null,
    quantity: item.quantity,
    unitPrice: item.price?.value ?? null,
    totalPrice: item.totalPrice ?? null
  }));
  const skus = [...new Set(lineItems.map((item) => item.sku).filter((sku): sku is string => !!sku))];
  const inventory = skus.length
    ? (
        await commercetoolsGraphql<InventoryResponse>(
          `query QuoteReviewInventory($where: String!, $limit: Int!) {
            inventoryEntries(where: $where, limit: $limit) { results { sku availableQuantity supplyChannel { key } } }
          }`,
          {
            where: `sku in (${skus.map((sku) => `"${escapeWhere(sku)}"`).join(", ")})`,
            limit: 500
          }
        )
      ).inventoryEntries.results
    : [];
  return {
    id: quote.id,
    key: quote.key ?? null,
    version: quote.version,
    quoteRequestState: quote.quoteRequestState ?? null,
    comment: quote.comment ?? null,
    createdAt: quote.createdAt ?? null,
    lastModifiedAt: quote.lastModifiedAt ?? null,
    totalPrice: quote.totalPrice ?? null,
    businessUnit: quote.businessUnit ?? null,
    customer: quote.customer ?? null,
    shippingAddress: quote.shippingAddress ?? null,
    billingAddress: quote.billingAddress ?? null,
    lineItems,
    // SKUs absent here have no inventory tracking in commercetools; stock is unknown, not zero.
    inventory: skus.map((sku) => ({
      sku,
      tracked: inventory.some((entry) => entry.sku === sku),
      entries: inventory
        .filter((entry) => entry.sku === sku)
        .map((entry) => ({
          channel: entry.supplyChannel?.key ?? null,
          availableQuantity: entry.availableQuantity
        }))
    }))
  };
}

/** Applies an agent-approved decision only to the exact quote version that was reviewed. */
export async function updateReviewedQuoteRequest(args: {
  id: string;
  expectedVersion: number;
  state: string;
}) {
  if (!["Accepted", "Rejected"].includes(args.state))
    throw new Error("Unsupported quote request decision.");
  const current = await commercetoolsGraphql<StateResponse>(
    `query ReviewedQuoteRequestState($id: String!) { quoteRequest(id: $id) { version quoteRequestState } }`,
    { id: args.id }
  );
  if (!current.quoteRequest) throw new Error("Quote request not found.");
  if (current.quoteRequest.version !== args.expectedVersion)
    throw new Error("The quote request changed. Prepare a new proposal.");
  if (current.quoteRequest.quoteRequestState !== "Submitted")
    throw new Error("Only submitted quote requests can be decided.");
  const data = await commercetoolsGraphql<UpdateResponse>(
    `mutation ReviewedQuoteRequestDecision($id: String!, $version: Long!, $actions: [QuoteRequestUpdateAction!]!) {
      updateQuoteRequest(id: $id, version: $version, actions: $actions) { id version quoteRequestState }
    }`,
    {
      id: args.id,
      version: args.expectedVersion,
      actions: [{ changeQuoteRequestState: { quoteRequestState: args.state } }]
    }
  );
  if (data.updateQuoteRequest.quoteRequestState !== args.state)
    throw new Error("Quote request decision was not confirmed.");
  return data.updateQuoteRequest;
}
