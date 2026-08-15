/**
 * GET /api/products/[id]
 *
 * Returns the full rich product detail for a given product ID, including
 * priceMode, taxCategory, categories with ancestors, and all variants with
 * inventory data. Proxies the productDetail(id) query to the BFF.
 */

import { type NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";
import { bffJsonHeaders } from "@/lib/commerce-headers";
import { requestLogger } from "@/lib/request-logger";

const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const PRODUCT_DETAIL_QUERY = `
  query ProductDetail($id: ID!) {
    productDetail(id: $id)
  }
`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { log, requestId } = requestLogger(request, 'api/products/[id]');
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing product id" },
      { status: 400 }
    );
  }

  try {
    const res = await projectScopedBffFetch(BFF_URL, {
      method: "POST",
      headers: bffJsonHeaders(),
      body: JSON.stringify({
        query: PRODUCT_DETAIL_QUERY,
        variables: { id },
      }),
    }, requestId);

    if (!res.ok) {
      log.error('BFF returned non-ok', undefined, { status: res.status, productId: id });
      return NextResponse.json(
        { error: `Commerce backend unavailable (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      data?: { productDetail?: unknown };
      errors?: Array<{ message?: string }>;
    };

    if (data?.errors?.length) {
      const msg = data.errors
        .map((e) => e.message)
        .filter(Boolean)
        .join("; ");
      log.error('GraphQL errors', undefined, { productId: id, message: msg });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const product = data?.data?.productDetail ?? null;
    return NextResponse.json(product, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    log.error('fetch failed', err, { productId: id });
    return NextResponse.json(
      { error: "Failed to load product." },
      { status: 500 }
    );
  }
}
