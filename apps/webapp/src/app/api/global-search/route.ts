import { NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch, ProjectSessionError } from "@/lib/project-scoped-bff";
import type { GlobalSearchEntity, GlobalSearchGroup, GlobalSearchResult } from "@/features/global-search/types";

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";
const DEFAULT_LIMIT = 5;

const ENTITY_QUERIES: Record<GlobalSearchEntity, string> = {
  customers: `
  query SearchCustomers($query: String!, $limit: Int!) {
    searchCustomers(text: $query, limit: $limit) {
      total
      results {
        id
        customerNumber
        email
        firstName
        lastName
        companyName
      }
    }
  }
`,
  tickets: `
  query SearchTickets($query: String!, $limit: Int!) {
    ticketPage(search: $query, limit: $limit, sortKey: "lastModifiedAt", sortOrder: "desc") {
      total
      results {
        id
        ticketNumber
        subject
        customerName
        customerEmail
        status
        priority
      }
    }
  }
`,
  orders: `
  query SearchOrders($query: String!, $limit: Int!) {
    orderPage(orderRef: $query, limit: $limit, sortKey: "createdAt", sortOrder: "desc") {
      total
      results {
        id
        orderNumber
        customerEmail
        orderState
        state
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`,
  carts: `
  query SearchCarts($query: String!, $limit: Int!) {
    searchCarts(text: $query, limit: $limit) {
      total
      results {
        id
        key
        customerId
        currencyCode
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
        lineItems {
          id
        }
      }
    }
  }
`,
  products: `
  query SearchProducts($query: String!, $limit: Int!) {
    productSearch(text: $query, locale: "en", currency: "USD", limit: $limit)
  }
`,
  b2b_companies: `
  query SearchCompanies($query: String!, $limit: Int!) {
    companies(searchField: "all", searchText: $query, limit: $limit) {
      total
      results {
        id
        key
        name
        status
        unitType
        contactEmail
      }
    }
  }
`,
  b2b_employees: `
  query SearchEmployees($query: String!, $limit: Int!) {
    b2bCustomers(searchText: $query, limit: $limit) {
      total
      results {
        id
        customerNumber
        externalId
        email
        firstName
        lastName
        companyName
      }
    }
  }
`,
  b2b_quotes: `
  query SearchQuotes($limit: Int!) {
    quotes(limit: $limit) {
      total
      results {
        id
        key
        quoteNumber
        companyKey
        companyName
        customerEmail
        status
        totalPrice {
          centAmount
          currencyCode
          fractionDigits
        }
      }
    }
  }
`
};

const ALL_ENTITIES: GlobalSearchEntity[] = [
  "customers",
  "orders",
  "products",
  "tickets",
  "carts",
  "b2b_companies",
  "b2b_employees",
  "b2b_quotes"
];

type GraphqlResponse = {
  data?: Record<string, unknown>;
  errors?: Array<{ message?: string; path?: Array<string | number> }>;
};

export async function POST(request: NextRequest) {
  let body: { query?: unknown; entities?: unknown };
  try {
    body = (await request.json()) as { query?: unknown; entities?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2) {
    return NextResponse.json({ query, groups: [] });
  }

  const entities = Array.isArray(body.entities)
    ? body.entities.filter((entity): entity is GlobalSearchEntity => ALL_ENTITIES.includes(entity as GlobalSearchEntity))
    : ALL_ENTITIES;

  try {
    const settledGroups = await Promise.allSettled(entities.map((entity) => searchEntity(entity, query)));
    const groups = settledGroups.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            entity: entities[index],
            status: "error" as const,
            results: [],
            error: result.reason instanceof Error ? result.reason.message : "Search failed"
          }
    );

    return NextResponse.json({ query, groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    const status = error instanceof ProjectSessionError ? error.status : 200;
    return NextResponse.json({ query, groups: errorGroups(entities, message) }, { status });
  }
}

async function searchEntity(entity: GlobalSearchEntity, searchText: string): Promise<GlobalSearchGroup> {
  const response = await projectScopedBffFetch(BFF_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csa-commerce-platform": process.env.BFF_COMMERCE_PLATFORM ?? "commercetools"
    },
    body: JSON.stringify({
      query: ENTITY_QUERIES[entity],
      variables: entity === "b2b_quotes" ? { limit: DEFAULT_LIMIT } : { query: searchText, limit: DEFAULT_LIMIT }
    }),
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    return { entity, status: "error", results: [], error: `BFF returned HTTP ${response.status}` };
  }

  const payload = (await response.json()) as GraphqlResponse;
  const entityError = payload.errors?.[0];
  if (entityError) {
    return { entity, status: "error", results: [], error: entityError.message };
  }

  const data = payload.data ?? {};
  try {
    switch (entity) {
      case "customers": {
        const page = asPage(data.searchCustomers);
        return { entity, status: "ok", total: page.total, results: page.results.map(mapCustomer) };
      }
      case "tickets": {
        const page = asPage(data.ticketPage);
        return { entity, status: "ok", total: page.total, results: page.results.map(mapTicket) };
      }
      case "orders": {
        const page = asPage(data.orderPage);
        return { entity, status: "ok", total: page.total, results: page.results.map(mapOrder) };
      }
      case "carts": {
        const page = asPage(data.searchCarts);
        return { entity, status: "ok", total: page.total, results: page.results.map(mapCart) };
      }
      case "products": {
        const page = asPage(data.productSearch);
        return { entity, status: "ok", total: page.total, results: page.results.map(mapProduct) };
      }
      case "b2b_companies": {
        const page = asPage(data.companies);
        return { entity, status: "ok", total: page.total, results: page.results.map(mapCompany) };
      }
      case "b2b_employees": {
        const page = asPage(data.b2bCustomers);
        return { entity, status: "ok", total: page.total, results: page.results.map(mapEmployee) };
      }
      case "b2b_quotes": {
        const page = asPage(data.quotes);
        const filtered = page.results.filter((result) => objectContains(result, searchText));
        return { entity, status: "ok", total: filtered.length, results: filtered.map(mapQuote) };
      }
    }
  } catch (error) {
    return { entity, status: "error", results: [], error: error instanceof Error ? error.message : "Mapping failed" };
  }
}

function errorGroups(entities: GlobalSearchEntity[], message: string): GlobalSearchGroup[] {
  return entities.map((entity) => ({ entity, status: "error", results: [], error: message }));
}

function asPage(value: unknown): { results: Record<string, unknown>[]; total: number } {
  if (!value || typeof value !== "object") return { results: [], total: 0 };
  const record = value as { results?: unknown; total?: unknown };
  return {
    results: Array.isArray(record.results) ? (record.results as Record<string, unknown>[]) : [],
    total: typeof record.total === "number" ? record.total : Array.isArray(record.results) ? record.results.length : 0
  };
}

function mapCustomer(customer: Record<string, unknown>): GlobalSearchResult {
  const firstName = stringValue(customer.firstName);
  const lastName = stringValue(customer.lastName);
  const email = stringValue(customer.email);
  const title = [firstName, lastName].filter(Boolean).join(" ") || email || stringValue(customer.customerNumber) || "Customer";
  return {
    id: stringValue(customer.id),
    entity: "customers",
    title,
    subtitle: [email, stringValue(customer.companyName)].filter(Boolean).join(" · ") || "Customer profile",
    url: `/customers/${encodeURIComponent(stringValue(customer.id))}`,
    initials: initials(title),
    badge: stringValue(customer.customerNumber) || undefined
  };
}

function mapEmployee(customer: Record<string, unknown>): GlobalSearchResult {
  const firstName = stringValue(customer.firstName);
  const lastName = stringValue(customer.lastName);
  const email = stringValue(customer.email);
  const title = [firstName, lastName].filter(Boolean).join(" ") || email || "Employee";
  return {
    id: stringValue(customer.id),
    entity: "b2b_employees",
    title,
    subtitle: [email, stringValue(customer.companyName)].filter(Boolean).join(" · ") || "Business unit employee",
    url: `/b2b/employees/${encodeURIComponent(stringValue(customer.id))}`,
    initials: initials(title),
    badge: stringValue(customer.customerNumber) || undefined
  };
}

function mapTicket(ticket: Record<string, unknown>): GlobalSearchResult {
  const ticketNumber = stringValue(ticket.ticketNumber) || stringValue(ticket.id);
  return {
    id: stringValue(ticket.id),
    entity: "tickets",
    title: `${ticketNumber} · ${stringValue(ticket.subject) || "Support ticket"}`,
    subtitle: [stringValue(ticket.customerName), stringValue(ticket.customerEmail), stringValue(ticket.priority)]
      .filter(Boolean)
      .join(" · "),
    url: `/tickets/${encodeURIComponent(stringValue(ticket.id))}`,
    badge: stringValue(ticket.status) || undefined
  };
}

function mapOrder(order: Record<string, unknown>): GlobalSearchResult {
  const id = stringValue(order.id);
  const orderNumber = stringValue(order.orderNumber) || id;
  return {
    id,
    entity: "orders",
    title: `Order ${orderNumber}`,
    subtitle: [stringValue(order.customerEmail), money(order.totalPrice)].filter(Boolean).join(" · "),
    url: `/orders/${encodeURIComponent(id)}`,
    badge: stringValue(order.orderState) || stringValue(order.state) || undefined
  };
}

function mapCart(cart: Record<string, unknown>): GlobalSearchResult {
  const id = stringValue(cart.id);
  const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems.length : 0;
  return {
    id,
    entity: "carts",
    title: `Cart ${stringValue(cart.key) || id}`,
    subtitle: [stringValue(cart.customerId), `${lineItems} item${lineItems === 1 ? "" : "s"}`, money(cart.totalPrice)]
      .filter(Boolean)
      .join(" · "),
    url: `/cart/${encodeURIComponent(id)}`,
    badge: stringValue(cart.currencyCode) || undefined
  };
}

function mapProduct(product: Record<string, unknown>): GlobalSearchResult {
  const id = stringValue(product.id);
  const title = productName(product) || stringValue(product.name) || stringValue(product.key) || stringValue(product.sku) || "Product";
  return {
    id,
    entity: "products",
    title,
    subtitle: [stringValue(product.key), productSku(product), productDescription(product)].filter(Boolean).join(" · "),
    url: `/products/${encodeURIComponent(id)}`,
    imageUrl: productImage(product),
    badge: productSku(product) || undefined
  };
}

function mapCompany(company: Record<string, unknown>): GlobalSearchResult {
  const id = stringValue(company.id);
  return {
    id,
    entity: "b2b_companies",
    title: stringValue(company.name) || stringValue(company.key) || "Company",
    subtitle: [stringValue(company.key), stringValue(company.contactEmail), stringValue(company.unitType)].filter(Boolean).join(" · "),
    url: `/b2b/company/${encodeURIComponent(id)}`,
    badge: stringValue(company.status) || undefined
  };
}

function mapQuote(quote: Record<string, unknown>): GlobalSearchResult {
  const id = stringValue(quote.id);
  return {
    id,
    entity: "b2b_quotes",
    title: `Quote ${stringValue(quote.quoteNumber) || stringValue(quote.key) || id}`,
    subtitle: [stringValue(quote.companyName), stringValue(quote.customerEmail), money(quote.totalPrice)].filter(Boolean).join(" · "),
    url: `/b2b/quotes/${encodeURIComponent(id)}`,
    badge: stringValue(quote.status) || undefined
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function money(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as { centAmount?: unknown; currencyCode?: unknown; fractionDigits?: unknown };
  if (typeof record.centAmount !== "number" || typeof record.currencyCode !== "string") return "";
  const fractionDigits = typeof record.fractionDigits === "number" ? record.fractionDigits : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: record.currencyCode
  }).format(record.centAmount / 10 ** fractionDigits);
}

function productName(product: Record<string, unknown>) {
  const current = productCurrent(product);
  const localized = (current?.nameAllLocales as Array<{ value?: unknown }> | undefined)?.find(
    (entry) => typeof entry.value === "string"
  );
  return stringValue(localized?.value);
}

function productDescription(product: Record<string, unknown>) {
  const current = productCurrent(product);
  const localized = (current?.descriptionAllLocales as Array<{ value?: unknown }> | undefined)?.find(
    (entry) => typeof entry.value === "string"
  );
  return stringValue(localized?.value);
}

function productSku(product: Record<string, unknown>) {
  const current = productCurrent(product);
  const variant = current?.masterVariant as Record<string, unknown> | undefined;
  return stringValue(product.sku) || stringValue(variant?.sku);
}

function productImage(product: Record<string, unknown>) {
  const current = productCurrent(product);
  const variant = current?.masterVariant as Record<string, unknown> | undefined;
  const images = variant?.images;
  if (Array.isArray(images)) {
    const image = images.find((entry) => typeof (entry as { url?: unknown }).url === "string") as { url?: string } | undefined;
    return image?.url;
  }
  return stringValue(product.imageUrl);
}

function productCurrent(product: Record<string, unknown>) {
  const masterData = product.masterData as Record<string, unknown> | undefined;
  return masterData?.current as Record<string, unknown> | undefined;
}

function objectContains(value: unknown, query: string) {
  return JSON.stringify(value).toLowerCase().includes(query.toLowerCase());
}
