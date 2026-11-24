import "server-only";
import { GoogleAuth, type IdTokenClient } from "google-auth-library";

export class HubCatalogError extends Error {
  constructor(readonly status: number) {
    super("Connection Hub catalog is unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function previewCatalogEnabled() {
  const setting = process.env.CONNECTION_HUB_PREVIEW_CATALOG?.trim();
  if (setting && !["true", "false"].includes(setting)) throw new HubCatalogError(503);
  // Keep the extended catalog on by default for Studio demos. Production can
  // explicitly opt out without changing or redeploying the application code.
  return setting !== "false";
}

function configuration() {
  if (process.env.CONNECTION_HUB_ENABLED !== "true") throw new HubCatalogError(503);
  const production = process.env.USE_CONNECTION_HUB_PROD ?? "false";
  const privateHub = process.env.CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH ?? "false";
  if (!["true", "false"].includes(production) || !["true", "false"].includes(privateHub))
    throw new HubCatalogError(503);
  const rawUrl =
    production === "true"
      ? process.env.CONNECTION_HUB_PROD_URL
      : process.env.CONNECTION_HUB_URL;
  const apiKey = (
    production === "true"
      ? process.env.CONNECTION_HUB_PROD_API_KEY
      : process.env.CONNECTION_HUB_API_KEY
  )?.trim();
  if (!rawUrl || !apiKey || apiKey.length < 16 || /\s/.test(apiKey))
    throw new HubCatalogError(503);
  const url = new URL(rawUrl.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        production === "false" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new HubCatalogError(503);
  return {
    origin: url.origin,
    apiKey,
    privateHub: privateHub === "true",
    previewCatalog: previewCatalogEnabled()
  };
}

function connector(value: unknown): HubCatalogConnector {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    typeof value.category !== "string" ||
    !record(value.authentication) ||
    typeof value.authentication.type !== "string" ||
    !Array.isArray(value.actions)
  )
    throw new HubCatalogError(502);
  const actions = value.actions.map((action: unknown) => {
    if (
      !record(action) ||
      typeof action.id !== "string" ||
      !action.id ||
      typeof action.name !== "string" ||
      typeof action.readOnly !== "boolean"
    )
      throw new HubCatalogError(502);
    return { id: action.id, name: action.name, readOnly: action.readOnly };
  });
  if (new Set(actions.map((action) => action.id)).size !== actions.length)
    throw new HubCatalogError(502);
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    category: value.category,
    authenticationType: value.authentication.type,
    availability: "available",
    actions
  };
}

const previewConnectors: HubCatalogConnector[] = [
  {
    id: "commercetools",
    name: "commercetools",
    description: "Composable commerce access for products, customers, carts and orders.",
    category: "Commerce platform",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      { id: "products-search", name: "Search products", readOnly: true },
      { id: "products-read", name: "Get product details", readOnly: true },
      { id: "inventory-read", name: "Check inventory availability", readOnly: true },
      { id: "prices-read", name: "Get product pricing", readOnly: true },
      { id: "customers-search", name: "Search customers", readOnly: true },
      { id: "customers-read", name: "Get customer", readOnly: true },
      { id: "carts-read", name: "Get cart", readOnly: true },
      { id: "orders-search", name: "Search orders", readOnly: true },
      { id: "orders-read", name: "Get order", readOnly: true },
      { id: "carts-manage", name: "Manage cart", readOnly: false },
      { id: "orders-create", name: "Create order", readOnly: false },
      { id: "orders-update", name: "Update order", readOnly: false },
      { id: "orders-cancel", name: "Cancel order", readOnly: false },
      { id: "returns-create", name: "Create return", readOnly: false },
      { id: "payments-read", name: "Get payment status", readOnly: true }
    ]
  },
  {
    id: "shopify",
    name: "Shopify Plus",
    description:
      "Storefront, customer, order, fulfillment and refund operations for Shopify.",
    category: "Commerce platform",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      { id: "products-search", name: "Search products", readOnly: true },
      { id: "products-read", name: "Get product details", readOnly: true },
      { id: "inventory-read", name: "Check inventory availability", readOnly: true },
      { id: "inventory-update", name: "Update inventory quantity", readOnly: false },
      { id: "customers-search", name: "Search customers", readOnly: true },
      { id: "customers-read", name: "Get customer", readOnly: true },
      { id: "orders-search", name: "Search orders", readOnly: true },
      { id: "orders-read", name: "Get order", readOnly: true },
      { id: "orders-cancel", name: "Cancel order", readOnly: false },
      {
        id: "fulfillment-orders-read",
        name: "Get fulfillment orders",
        readOnly: true
      },
      { id: "fulfillments-read", name: "Track fulfillment", readOnly: true },
      { id: "fulfillments-create", name: "Create fulfillment", readOnly: false },
      { id: "refunds-create", name: "Create refund", readOnly: false }
    ]
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    description: "Catalog, customer, order and shipment access for BigCommerce stores.",
    category: "Commerce platform",
    authenticationType: "ACCESS_TOKEN",
    availability: "preview",
    actions: [
      { id: "catalog-search", name: "Search catalog", readOnly: true },
      { id: "products-read", name: "Get product details", readOnly: true },
      { id: "inventory-read", name: "Check inventory availability", readOnly: true },
      { id: "inventory-update", name: "Update inventory quantity", readOnly: false },
      { id: "customers-search", name: "Search customers", readOnly: true },
      { id: "customers-read", name: "Get customer", readOnly: true },
      { id: "customers-update", name: "Update customer", readOnly: false },
      { id: "carts-read", name: "Get cart", readOnly: true },
      { id: "orders-search", name: "Search orders", readOnly: true },
      { id: "orders-read", name: "Get order", readOnly: true },
      { id: "orders-update", name: "Update order", readOnly: false },
      { id: "shipments-read", name: "Get shipments", readOnly: true },
      { id: "shipments-create", name: "Create shipment", readOnly: false },
      { id: "refunds-create", name: "Create refund", readOnly: false }
    ]
  },
  {
    id: "sap-commerce-cloud",
    name: "SAP Commerce Cloud",
    description:
      "Enterprise catalog, inventory, customer and order operations for SAP Commerce Cloud.",
    category: "Commerce platform",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      { id: "catalog-search", name: "Search product catalog", readOnly: true },
      { id: "products-read", name: "Get product details", readOnly: true },
      { id: "categories-read", name: "List product categories", readOnly: true },
      { id: "inventory-read", name: "Check inventory", readOnly: true },
      { id: "customers-search", name: "Search customers", readOnly: true },
      { id: "customers-read", name: "Get customer", readOnly: true },
      { id: "customers-update", name: "Update customer", readOnly: false },
      { id: "carts-read", name: "Get cart", readOnly: true },
      { id: "carts-create", name: "Create cart", readOnly: false },
      { id: "cart-entries-manage", name: "Manage cart entries", readOnly: false },
      { id: "promotions-read", name: "Get promotions", readOnly: true },
      { id: "orders-search", name: "Search orders", readOnly: true },
      { id: "orders-read", name: "Get order", readOnly: true },
      { id: "orders-place", name: "Place order", readOnly: false }
    ]
  },
  {
    id: "sap-s4hana",
    name: "SAP S/4HANA",
    description:
      "ERP access to business partners, stock, sales orders, invoices and returns.",
    category: "ERP & operations",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      {
        id: "business-partners-search",
        name: "Search business partners",
        readOnly: true
      },
      { id: "business-partners-read", name: "Get business partner", readOnly: true },
      { id: "materials-read", name: "Get material", readOnly: true },
      { id: "inventory-read", name: "Check available stock", readOnly: true },
      { id: "sales-orders-search", name: "Search sales orders", readOnly: true },
      { id: "sales-orders-read", name: "Get sales order", readOnly: true },
      { id: "sales-orders-simulate", name: "Simulate sales order", readOnly: true },
      { id: "sales-orders-create", name: "Create sales order", readOnly: false },
      { id: "sales-orders-update", name: "Update sales order", readOnly: false },
      { id: "sales-orders-cancel", name: "Cancel sales order", readOnly: false },
      { id: "billing-documents-read", name: "Get billing document", readOnly: true },
      { id: "returns-create", name: "Create return order", readOnly: false }
    ]
  },
  {
    id: "microsoft-dynamics-365",
    name: "Microsoft Dynamics 365",
    description:
      "Customer, inventory, sales order and fulfillment context from Dynamics 365.",
    category: "ERP & operations",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      { id: "customers-search", name: "Search customer accounts", readOnly: true },
      { id: "customers-read", name: "Get customer account", readOnly: true },
      { id: "customers-update", name: "Update customer account", readOnly: false },
      { id: "products-search", name: "Search released products", readOnly: true },
      { id: "products-read", name: "Get released product", readOnly: true },
      { id: "inventory-read", name: "Check on-hand inventory", readOnly: true },
      { id: "sales-orders-search", name: "Search sales orders", readOnly: true },
      { id: "sales-orders-read", name: "Get sales order", readOnly: true },
      { id: "sales-orders-create", name: "Create sales order", readOnly: false },
      { id: "sales-orders-update", name: "Update sales order", readOnly: false },
      { id: "fulfillments-read", name: "Track fulfillment", readOnly: true },
      { id: "returns-create", name: "Create return order", readOnly: false }
    ]
  },
  {
    id: "oracle-netsuite",
    name: "Oracle NetSuite",
    description:
      "ERP customer, item, sales order, fulfillment and return authorization access.",
    category: "ERP & operations",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      { id: "customers-search", name: "Search customers", readOnly: true },
      { id: "customers-read", name: "Get customer", readOnly: true },
      { id: "customers-update", name: "Update customer", readOnly: false },
      { id: "items-search", name: "Search items", readOnly: true },
      { id: "items-read", name: "Get item", readOnly: true },
      { id: "inventory-read", name: "Get inventory availability", readOnly: true },
      { id: "sales-orders-search", name: "Search sales orders", readOnly: true },
      { id: "sales-orders-read", name: "Get sales order", readOnly: true },
      { id: "sales-orders-create", name: "Create sales order", readOnly: false },
      { id: "sales-orders-update", name: "Update sales order", readOnly: false },
      { id: "fulfillments-read", name: "Get item fulfillment", readOnly: true },
      { id: "invoices-read", name: "Get invoice", readOnly: true },
      { id: "returns-create", name: "Create return authorization", readOnly: false }
    ]
  },
  {
    id: "contentful",
    name: "Contentful",
    description:
      "Structured content and digital assets from Contentful spaces and environments.",
    category: "CMS & digital experience",
    authenticationType: "ACCESS_TOKEN",
    availability: "preview",
    actions: [
      { id: "content-types-list", name: "List content types", readOnly: true },
      { id: "entries-search", name: "Search entries", readOnly: true },
      { id: "entries-read", name: "Get published entry", readOnly: true },
      { id: "entries-preview", name: "Preview entry", readOnly: true },
      { id: "assets-list", name: "List assets", readOnly: true },
      { id: "assets-read", name: "Get asset", readOnly: true },
      { id: "environments-list", name: "List environments", readOnly: true },
      { id: "locales-list", name: "List locales", readOnly: true }
    ]
  },
  {
    id: "amplience",
    name: "Amplience",
    description:
      "Headless content, media and delivery previews from Amplience repositories.",
    category: "CMS & digital experience",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      { id: "repositories-list", name: "List content repositories", readOnly: true },
      { id: "content-types-list", name: "List content types", readOnly: true },
      { id: "content-search", name: "Search content items", readOnly: true },
      { id: "content-read", name: "Get content item", readOnly: true },
      { id: "content-delivery-read", name: "Get delivery content", readOnly: true },
      { id: "content-preview", name: "Preview delivery content", readOnly: true },
      { id: "assets-search", name: "Search media assets", readOnly: true },
      { id: "assets-read", name: "Get media asset", readOnly: true },
      { id: "publication-status-read", name: "Get publication status", readOnly: true }
    ]
  },
  {
    id: "adobe-experience-manager",
    name: "Adobe Experience Manager",
    description:
      "Experience fragments, content pages and digital assets from Adobe Experience Manager.",
    category: "CMS & digital experience",
    authenticationType: "OAUTH2",
    availability: "preview",
    actions: [
      { id: "fragments-list", name: "List content fragments", readOnly: true },
      { id: "fragments-read", name: "Get content fragment", readOnly: true },
      { id: "fragments-preview", name: "Preview content fragment", readOnly: true },
      {
        id: "fragment-models-list",
        name: "List content fragment models",
        readOnly: true
      },
      { id: "fragments-create", name: "Create content fragment", readOnly: false },
      { id: "fragments-update", name: "Update content fragment", readOnly: false },
      { id: "assets-search", name: "Search digital assets", readOnly: true },
      { id: "assets-read", name: "Get digital asset", readOnly: true },
      { id: "assets-upload", name: "Upload digital asset", readOnly: false },
      { id: "assets-update", name: "Update digital asset", readOnly: false }
    ]
  },
  {
    id: "bloomreach-discovery",
    name: "Bloomreach Discovery",
    description:
      "Commerce search, autosuggest, merchandising and product recommendations from Bloomreach Discovery.",
    category: "Search & merchandising",
    authenticationType: "API_KEY",
    availability: "preview",
    actions: [
      { id: "products-search", name: "Search products", readOnly: true },
      { id: "categories-search", name: "Search categories", readOnly: true },
      { id: "content-search", name: "Search content", readOnly: true },
      { id: "autosuggest", name: "Get search suggestions", readOnly: true },
      { id: "recommendations", name: "Get product recommendations", readOnly: true },
      { id: "bestsellers", name: "Get bestsellers", readOnly: true },
      { id: "visual-search", name: "Find visually similar products", readOnly: true }
    ]
  },
  {
    id: "bloomreach-engagement",
    name: "Bloomreach Engagement",
    description:
      "Customer data, behavioral events, catalogs and campaign automation through Bloomreach Engagement.",
    category: "Marketing automation",
    authenticationType: "BASIC_AUTH",
    availability: "preview",
    actions: [
      { id: "customers-read", name: "Get customer profile", readOnly: true },
      {
        id: "recommendations-read",
        name: "Get customer recommendations",
        readOnly: true
      },
      { id: "reports-read", name: "Get campaign report", readOnly: true },
      { id: "events-track", name: "Track customer event", readOnly: false },
      { id: "customers-update", name: "Update customer attributes", readOnly: false },
      { id: "catalogs-manage", name: "Manage catalog items", readOnly: false },
      { id: "scenarios-trigger", name: "Trigger campaign scenario", readOnly: false },
      { id: "customers-export", name: "Export customer data", readOnly: true }
    ]
  }
];

function withPreviewCatalog(connectors: HubCatalogConnector[], previewCatalog: boolean) {
  if (!previewCatalog) return connectors;
  const liveIds = new Set(connectors.map((item) => item.id));
  return [...connectors, ...previewConnectors.filter((item) => !liveIds.has(item.id))];
}

async function list(): Promise<HubCatalogConnector[]> {
  try {
    const config = configuration();
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    };
    if (config.privateHub) {
      let pending = clients.get(config.origin);
      if (!pending) {
        pending = auth.getIdTokenClient(config.origin);
        clients.set(config.origin, pending);
        pending.catch(() => clients.delete(config.origin));
      }
      const identity = (await (await pending).getRequestHeaders()).get("authorization");
      if (!identity?.startsWith("Bearer ")) throw new HubCatalogError(503);
      headers["X-Serverless-Authorization"] = identity;
    }
    const connectors: HubCatalogConnector[] = [];
    const ids = new Set<string>();
    const cursors = new Set<string>();
    const signal = AbortSignal.timeout(20000);
    let after: string | null = null;
    for (;;) {
      const response = await fetch(`${config.origin}/graphql`, {
        method: "POST",
        headers,
        redirect: "error",
        cache: "no-store",
        signal,
        body: JSON.stringify({ query: QUERY, variables: { first: 50, after } })
      });
      if (!response.ok) throw new HubCatalogError(502);
      const payload: unknown = await response.json();
      if (
        !record(payload) ||
        payload.errors !== undefined ||
        !record(payload.data) ||
        !record(payload.data.connectors)
      )
        throw new HubCatalogError(502);
      const page = payload.data.connectors;
      if (
        !Array.isArray(page.nodes) ||
        !record(page.pageInfo) ||
        typeof page.pageInfo.hasNextPage !== "boolean"
      )
        throw new HubCatalogError(502);
      for (const node of page.nodes) {
        const item = connector(node);
        if (ids.has(item.id)) throw new HubCatalogError(502);
        ids.add(item.id);
        connectors.push(item);
      }
      if (!page.pageInfo.hasNextPage)
        return withPreviewCatalog(connectors, config.previewCatalog);
      const cursor = page.pageInfo.endCursor;
      if (
        !page.nodes.length ||
        typeof cursor !== "string" ||
        !cursor ||
        cursors.has(cursor)
      )
        throw new HubCatalogError(502);
      cursors.add(cursor);
      after = cursor;
    }
  } catch (error) {
    if (error instanceof HubCatalogError) throw error;
    throw new HubCatalogError(502);
  }
}

const QUERY = `query CustomerSaxConnectorCatalog($first: Int!, $after: ID) {
  connectors(first: $first, after: $after) {
    nodes { id name description category authentication { type } actions { id name readOnly } }
    pageInfo { endCursor hasNextPage }
  }
}`;
const auth = new GoogleAuth();
const clients = new Map<string, Promise<IdTokenClient>>();

export const connectionHubCatalog = { list };
export type HubCatalogConnector = {
  id: string;
  name: string;
  description: string;
  category: string;
  authenticationType: string;
  availability: "available" | "preview";
  actions: { id: string; name: string; readOnly: boolean }[];
};
