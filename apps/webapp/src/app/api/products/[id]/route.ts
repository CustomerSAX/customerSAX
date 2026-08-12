/**
 * GET /api/products/[id]
 *
 * Returns the full rich product detail for a given product ID, including
 * priceMode, taxCategory, categories with ancestors, and all variants with
 * inventory data. Proxies the productDetail(id) query to the BFF.
 */

import { type NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";

const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const PRODUCT_DETAIL_QUERY = `
  query ProductDetail($id: ID!) {
    productDetail(id: $id)
  }
`;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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
      headers: {
        "Content-Type": "application/json",
        "x-csa-commerce-platform": "commercetools",
      },
      body: JSON.stringify({
        query: PRODUCT_DETAIL_QUERY,
        variables: { id },
      }),
    });

    if (!res.ok) {
      console.error(`[api/products/${id}] BFF returned HTTP ${res.status}`);
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
      console.error(`[api/products/${id}] GraphQL errors: ${msg}`);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const product = data?.data?.productDetail ?? null;
    return NextResponse.json(product, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[api/products/${id}] Fetch failed:`, err);
    return NextResponse.json(
      { error: "Failed to load product." },
      { status: 500 }
    );
  }
}
