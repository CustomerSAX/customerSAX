/**
 * POST /api/products/prices
 *
 * Resolves standalone prices for a single SKU via the BFF standalonePrices query.
 * The Product List calls this per-SKU (batched client-side in the hook) to display
 * "From $X.XX" in the Price column.
 */

import { type NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";
import { bffJsonHeaders } from "@/lib/commerce-headers";
import { requestLogger } from "@/lib/request-logger";

const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const STANDALONE_PRICES_QUERY = `
  query StandalonePrices($sku: String!) {
    standalonePrices(sku: $sku)
  }
`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { log, requestId } = requestLogger(request, 'api/products/prices');
  let body: { sku?: unknown };
  try {
    body = (await request.json()) as { sku?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const sku =
    typeof body.sku === "string" && body.sku.trim() ? body.sku.trim() : null;

  if (!sku) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: "POST",
      headers: bffJsonHeaders(),
      body: JSON.stringify({
        query: STANDALONE_PRICES_QUERY,
        variables: { sku },
      }),
    }, requestId);

    if (!res.ok) {
      log.error('BFF returned non-ok', undefined, { status: res.status, sku });
      return NextResponse.json({ results: [] });
    }

    const data = (await res.json()) as {
      data?: { standalonePrices?: { results?: unknown[] } };
      errors?: Array<{ message?: string }>;
    };

    if (data?.errors?.length) {
      const msg = data.errors
        .map((e) => e.message)
        .filter(Boolean)
        .join("; ");
      log.error('GraphQL errors', undefined, { sku, message: msg });
      return NextResponse.json({ results: [] });
    }

    const results = data?.data?.standalonePrices?.results ?? [];
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    log.error('fetch failed', err, { sku });
    return NextResponse.json({ results: [] });
  }
}
