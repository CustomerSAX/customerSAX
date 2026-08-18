import { NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";
import { bffJsonHeaders } from "@/lib/commerce-headers";
import { requestLogger } from "@/lib/request-logger";

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

type GraphqlError = { message?: string };
type GraphqlResponse<T> = { data?: T; errors?: GraphqlError[] };

type BffDiscountCode = {
  id?: string | null;
  key?: string | null;
  code?: string | null;
  name?: string | Record<string, string> | null;
  isActive?: boolean | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

function graphqlErrorMessage(errors: GraphqlError[]) {
  return errors.map((error) => error.message ?? "Unknown GraphQL error").join("; ");
}

const DISCOUNT_CODES_QUERY = `
  query DiscountCodes($limit: Int) {
    discountCodes(limit: $limit) {
      id
      key
      code
      name
      isActive
      validFrom
      validUntil
    }
  }
`;

const DISCOUNT_CODES_CONNECTION_QUERY = `
  query DiscountCodesConnection($limit: Int) {
    discountCodes(limit: $limit) {
      results {
        id
        key
        code
        name
        isActive
        validFrom
        validUntil
      }
    }
  }
`;

function normalizeDiscountCodes(value: unknown): BffDiscountCode[] | null {
  if (Array.isArray(value)) {
    return value as BffDiscountCode[];
  }

  if (
    value &&
    typeof value === "object" &&
    "results" in value &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: BffDiscountCode[] }).results;
  }

  return null;
}

function discountCodeName(discount: BffDiscountCode) {
  if (typeof discount.name === "string" && discount.name.trim()) {
    return discount.name;
  }

  if (discount.name && typeof discount.name === "object") {
    return discount.name.en || Object.values(discount.name).find(Boolean) || discount.key || discount.code;
  }

  return discount.key || discount.code;
}

async function fetchDiscountCodes(query: string, requestId: string) {
  const response = await projectScopedBffFetch(
    BFF_URL,
    {
      method: "POST",
      headers: bffJsonHeaders(),
      body: JSON.stringify({
        query,
        variables: { limit: 100 },
      }),
    },
    requestId,
  );

  if (!response.ok) {
    return { ok: false as const, status: 502, error: "Unable to reach the commerce backend right now." };
  }

  const payload = (await response.json()) as GraphqlResponse<{ discountCodes?: unknown }>;
  if (payload.errors?.length) {
    return { ok: false as const, status: 502, error: graphqlErrorMessage(payload.errors) };
  }

  const discountCodes = normalizeDiscountCodes(payload.data?.discountCodes);
  if (!discountCodes) {
    return { ok: false as const, status: 502, error: "Discount codes are not exposed by the commerce backend yet." };
  }

  return { ok: true as const, discountCodes };
}

export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, "api/discount-codes");

  try {
    let result = await fetchDiscountCodes(DISCOUNT_CODES_QUERY, requestId);
    if (!result.ok) {
      log.warn("flat discount-code query failed; trying connection shape", { error: result.error });
      result = await fetchDiscountCodes(DISCOUNT_CODES_CONNECTION_QUERY, requestId);
    }

    if (!result.ok) {
      log.error("commerce backend error", undefined, { message: result.error });
      return NextResponse.json(
        { error: "Discount codes are not exposed by the commerce backend yet.", results: [] },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const results = result.discountCodes
      .filter((discount) => discount.code)
      .map((discount) => ({
        id: discount.id ?? discount.code,
        key: discount.key ?? undefined,
        code: discount.code,
        name: discountCodeName(discount),
        isActive: discount.isActive ?? true,
        validFrom: discount.validFrom ?? undefined,
        validUntil: discount.validUntil ?? undefined,
      }));

    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    log.error("fetch failed", error);
    return NextResponse.json(
      { error: "Unable to reach the commerce backend right now.", results: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
