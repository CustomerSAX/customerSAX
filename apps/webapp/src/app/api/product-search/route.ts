/**
 * POST /api/product-search
 *
 * Product search and browse for the Product Directory.
 * Proxies the productSearch(field, text, browse, locale, limit, offset, sortKey, sortOrder)
 * GraphQL query to the BFF, which handles both browse (empty query) and text search.
 *
 * Also supports GET for quick-search (AI assistant).
 *
 * Body (POST):
 *   { field?, text?, browse?, locale?, currency?, limit?, offset?, sortKey?, sortOrder? }
 * Returns:
 *   { results: CtRawProduct[], total: number }
 */

import { NextRequest, NextResponse } from "next/server";

const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const PRODUCT_SEARCH_QUERY = `
  query ProductSearch(
    $field: String
    $text: String
    $browse: Boolean
    $locale: String
    $currency: String
    $limit: Int
    $offset: Int
    $sortKey: String
    $sortOrder: String
  ) {
    productSearch(
      field: $field
      text: $text
      browse: $browse
      locale: $locale
      currency: $currency
      limit: $limit
      offset: $offset
      sortKey: $sortKey
      sortOrder: $sortOrder
    )
  }
`;

const QUICK_SEARCH_QUERY = `
  query QuickSearchProducts($q: String!, $limit: Int) {
    quickSearchProducts(q: $q, limit: $limit) {
      id sku name description imageUrl price { centAmount currencyCode fractionDigits }
    }
  }
`;

async function bffPost(query: string, variables: Record<string, unknown>) {
  const res = await fetch(BFF_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csa-commerce-platform": "commercetools",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    return { ok: false as const, reason: `BFF returned HTTP ${res.status}` };
  }
  const data = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string }>;
  };
  if (data?.errors?.length) {
    return {
      ok: false as const,
      reason: data.errors.map((e) => e.message).join("; "),
    };
  }
  return { ok: true as const, data: data.data ?? {} };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const field =
    typeof body.field === "string" ? body.field : undefined;
  const text =
    typeof body.text === "string" ? body.text.trim() : "";
  const browse = body.browse === true;
  const locale =
    typeof body.locale === "string" && body.locale ? body.locale : "en";
  const currency =
    typeof body.currency === "string" && body.currency
      ? body.currency
      : "USD";
  const limit = Number.isFinite(Number(body.limit))
    ? Math.min(Math.max(Math.trunc(Number(body.limit)), 1), 100)
    : 20;
  const offset = Number.isFinite(Number(body.offset))
    ? Math.max(Math.trunc(Number(body.offset)), 0)
    : 0;
  const sortKey =
    typeof body.sortKey === "string" ? body.sortKey : undefined;
  const sortOrder =
    body.sortOrder === "asc" ? "asc" : "desc";

  // No text and not explicitly browse → return empty (preserves legacy behavior
  // for the AI assistant search boxes that should not auto-list all products).
  if (!browse && !text) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const result = await bffPost(PRODUCT_SEARCH_QUERY, {
    field,
    text: text || undefined,
    browse: browse || undefined,
    locale,
    currency,
    limit,
    offset,
    sortKey,
    sortOrder,
  }).catch((err) => ({
    ok: false as const,
    reason: err instanceof Error ? err.message : String(err),
  }));

  if (!result.ok) {
    console.error(`[product-search] BFF unavailable: ${result.reason}`);
    return NextResponse.json(
      { error: "Product search temporarily unavailable", results: [], total: 0 },
      { status: 200 } // Soft-fail: return 200 so the list shows empty state not error
    );
  }

  const searchResult = result.data.productSearch as {
    results?: unknown[];
    total?: number;
  } | null;

  if (!searchResult) {
    return NextResponse.json({ results: [], total: 0 });
  }

  return NextResponse.json(
    { results: searchResult.results ?? [], total: searchResult.total ?? 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = (
    url.searchParams.get("query") ||
    url.searchParams.get("q") ||
    ""
  )
    .toLowerCase()
    .trim();

  if (!query) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const result = await bffPost(QUICK_SEARCH_QUERY, {
    q: query,
    limit: 10,
  }).catch((err) => ({
    ok: false as const,
    reason: err instanceof Error ? err.message : String(err),
  }));

  if (!result.ok) {
    console.error(`[product-search GET] BFF unavailable: ${result.reason}`);
    return NextResponse.json(
      { error: "Unable to reach the commerce backend right now.", results: [], total: 0 },
      { status: 502 }
    );
  }

  const results = (result.data.quickSearchProducts as unknown[]) ?? [];
  return NextResponse.json({ results, total: results.length });
}
